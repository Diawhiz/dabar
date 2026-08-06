import logging
import json
import shutil
from pathlib import Path
from urllib.parse import urlparse, parse_qs

import requests
import yt_dlp
from celery import shared_task
from decouple import config

try:
    import static_ffmpeg
    static_ffmpeg.add_paths()
except Exception:
    pass

from youtube_transcript_api import YouTubeTranscriptApi
from .models import Sermon, Transcript, TranscriptSegment
from .services.transcription import transcribe_sermon

logger = logging.getLogger(__name__)

TMP_ROOT = Path(__file__).resolve().parent.parent / "tmp_audio"
GROQ_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions"


def _sermon_tmp_dir(sermon_id):
    return TMP_ROOT / str(sermon_id)


def _cleanup_tmp_dir(sermon_id):
    shutil.rmtree(_sermon_tmp_dir(sermon_id), ignore_errors=True)


def _extract_youtube_id(url):
    parsed = urlparse(url)
    if parsed.hostname in {"youtu.be", "www.youtu.be"}:
        return parsed.path.strip("/")
    if parsed.hostname in {"youtube.com", "www.youtube.com", "m.youtube.com"}:
        if parsed.path == "/watch":
            return parse_qs(parsed.query).get("v", [None])[0]
        if parsed.path.startswith(("/shorts/", "/embed/")):
            return parsed.path.split("/")[2]
    return None


def _parse_timestamp(val):
    """Parse a timestamp value from LLM into float seconds (handles 135.0 or '02:15' or '135')."""
    if val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    val_str = str(val).strip()
    if ":" in val_str:
        parts = val_str.split(":")
        try:
            if len(parts) == 2:
                return float(parts[0]) * 60 + float(parts[1])
            elif len(parts) == 3:
                return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
        except ValueError:
            return 0.0
    try:
        return float(val_str.rstrip("s"))
    except ValueError:
        return 0.0


import re

SERMON_KEYWORDS = {
    "god", "jesus", "christ", "lord", "faith", "grace", "word", "truth", "promise",
    "covenant", "pray", "prayer", "glory", "holy", "spirit", "believe", "heart",
    "calling", "power", "listen", "remember", "testimony", "victory", "blessing",
    "purpose", "salvation", "mercy", "peace", "season", "waiting", "depth"
}


def _generate_title_from_text(raw_text):
    """
    Generate a 100% context-accurate clip title directly from spoken text.
    Extracts the most punchy sentence or clause from the transcript segment.
    """
    if not raw_text:
        return "Key Teaching Moment"

    text = " ".join(raw_text.split()).strip()
    sentences = [s.strip() for s in re.split(r'[.!?]+', text) if s.strip()]

    for sentence in sentences:
        words = sentence.split()
        if 3 <= len(words) <= 9:
            clean = sentence.strip('"\'()').strip()
            return clean[0].upper() + clean[1:] if len(clean) > 1 else clean.upper()
        elif len(words) > 9:
            phrase = " ".join(words[:7]).strip('"\'()').strip()
            return (phrase[0].upper() + phrase[1:] if len(phrase) > 1 else phrase.upper()) + "…"

    words = text.split()
    if words:
        phrase = " ".join(words[:7]).strip('"\'()').strip()
        return (phrase[0].upper() + phrase[1:] if len(phrase) > 1 else phrase.upper()) + "…"

    return "Key Preaching Moment"


def _fallback_heuristic_highlights(timestamped_segments):
    """
    Fallback highlight extractor when LLM API is unavailable or returns 0 highlights.
    Scores segments based on sermon keywords, punctuation cues, and word density.
    Returns 3 to 5 non-overlapping key moments with titles derived directly from spoken text.
    """
    if not timestamped_segments:
        return []

    scored = []
    for idx, seg in enumerate(timestamped_segments):
        text = seg.get("text", "").lower()
        words = text.split()
        if not words:
            continue

        kw_matches = sum(1 for w in words if w.strip(".,!?:;\"'()") in SERMON_KEYWORDS)
        punct_score = text.count("!") * 2.0 + text.count("?") * 1.5
        word_count_score = min(len(words) / 30.0, 2.0)

        total_score = (kw_matches * 3.0) + punct_score + word_count_score
        scored.append((total_score, idx, seg))

    scored.sort(key=lambda x: x[0], reverse=True)

    selected = []
    used_indices = set()

    for score, idx, seg in scored:
        if len(selected) >= 5:
            break
        if any(abs(idx - u) < 2 for u in used_indices):
            continue

        title = _generate_title_from_text(seg.get("text", ""))
        selected.append({
            "title": title,
            "start": float(seg["start"]),
            "end": float(seg["end"]),
            "reason": "High-impact teaching moment extracted from sermon transcript.",
        })
        used_indices.add(idx)

    selected.sort(key=lambda x: x["start"])
    return selected


from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


def _detect_highlights_with_llm(timestamped_segments, sermon_title=None):
    """
    Use llama-3.3-70b-versatile via Groq to identify key moments in a sermon.
    If API key is missing or call fails/returns empty, fallback to heuristic extraction.
    """
    if not timestamped_segments:
        return []

    api_key = config("GROQ_API_KEY", default=None)
    if api_key:
        # Sample segments if transcript is very long to prevent payload overflow & socket resets
        target_segs = timestamped_segments
        if len(timestamped_segments) > 80:
            step = len(timestamped_segments) / 80.0
            target_segs = [timestamped_segments[int(i * step)] for i in range(80)]

        lines = []
        for seg in target_segs:
            s_sec = round(float(seg["start"]), 1)
            e_sec = round(float(seg["end"]), 1)
            s_min, s_rem = divmod(int(s_sec), 60)
            e_min, e_rem = divmod(int(e_sec), 60)
            ts = f"[{s_sec}s - {e_sec}s] ({s_min:02d}:{s_rem:02d} - {e_min:02d}:{e_rem:02d})"
            lines.append(f"{ts} {seg['text']}")

        timestamped_text = "\n\n".join(lines)
        if len(timestamped_text) > 14000:
            timestamped_text = timestamped_text[:14000] + "\n\n[Transcript sampled for length]"

        sermon_ctx = f"for the sermon '{sermon_title}'" if sermon_title else ""

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        prompt = (
            f"You are a senior church media strategist producing viral social clips {sermon_ctx}.\n\n"
            "Below is the sermon transcript with exact timestamps in seconds. Find the 3 to 6 most powerful, "
            "contextually accurate key moments that will make viewers stop scrolling.\n\n"
            "CRITICAL TITLE REQUIREMENT:\n"
            "- Each highlight 'title' MUST be a punchy, 4-8 word title derived DIRECTLY from the actual spoken message in that segment.\n"
            "- Example: 'God Builds Depth Before Visibility', NOT generic titles like 'Clip 1' or 'Main Point'.\n\n"
            "RULES:\n"
            "- Each highlight MUST be 30-90 seconds long (a complete thought, not a fragment)\n"
            "- Output exact numerical float values for start and end in SECONDS\n\n"
            "Respond ONLY with this JSON format:\n"
            '{"highlights": [\n'
            '  {"title": "Exact Spoken Title", "start": 120.0, "end": 185.0, '
            '"reason": "Why this moment is powerful"}\n'
            "]}\n\n"
            f"SERMON TRANSCRIPT:\n\n{timestamped_text}"
        )

        data = {
            "model": "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": "You are a JSON assistant. Respond with valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.3,
        }

        try:
            logger.info("Calling Groq LLM (llama-3.3-70b-versatile) for highlight detection...")
            
            session = requests.Session()
            retries = Retry(total=2, backoff_factor=1, status_forcelist=[500, 502, 503, 504])
            session.mount("https://", HTTPAdapter(max_retries=retries))

            response = session.post(GROQ_COMPLETIONS_URL, headers=headers, json=data, timeout=35)
            if response.ok:
                content = response.json()["choices"][0]["message"]["content"]
                result = json.loads(content)
                raw_highlights = result.get("highlights", [])
                
                parsed_highlights = []
                for hl in raw_highlights:
                    hl_t = hl.get("title")
                    if not hl_t or hl_t.lower() in ["clip 1", "key moment", "short clip title", "main point"]:
                        hl_t = None
                    parsed_highlights.append({
                        "title": hl_t,
                        "start": _parse_timestamp(hl.get("start")),
                        "end": _parse_timestamp(hl.get("end")),
                        "reason": hl.get("reason", ""),
                    })

                if parsed_highlights:
                    logger.info("LLM detected %d key moments in sermon.", len(parsed_highlights))
                    return parsed_highlights
            else:
                logger.warning("Groq LLM API returned HTTP %d: %s", response.status_code, response.text[:300])
        except Exception as e:
            logger.warning("LLM highlight detection failed: %s", str(e))

    logger.info("Using heuristic highlight detector fallback...")
    return _fallback_heuristic_highlights(timestamped_segments)





def _group_youtube_transcript(yt_transcript):
    grouped = []
    current_text = []
    current_start = None
    current_end = 0.0

    for item in yt_transcript:
        if current_start is None:
            current_start = float(item.start)
        
        cleaned_snippet = item.text.replace("\n", " ").strip()
        if cleaned_snippet:
            current_text.append(cleaned_snippet)
        current_end = float(item.start) + float(item.duration)

        text_so_far = " ".join(current_text)
        if (current_end - current_start >= 35.0) and text_so_far.endswith((".", "?", "!", ";")):
            grouped.append({
                "start": current_start,
                "end": current_end,
                "text": text_so_far,
            })
            current_text = []
            current_start = None

    if current_text and current_start is not None:
        grouped.append({
            "start": current_start,
            "end": current_end,
            "text": " ".join(current_text),
        })

    return grouped


def _group_whisper_segments(whisper_segments):
    """Group raw Whisper segments into ~35-45 second paragraph blocks."""
    grouped = []
    current_text = []
    current_start = None
    current_end = 0.0

    for seg in whisper_segments:
        start_t = float(seg.get("start", 0.0))
        end_t = float(seg.get("end", 0.0))
        text = str(seg.get("text", "")).strip()

        if not text:
            continue

        if current_start is None:
            current_start = start_t

        current_text.append(text)
        current_end = end_t

        text_so_far = " ".join(current_text)
        if (current_end - current_start >= 35.0) and text_so_far.endswith((".", "?", "!", ";")):
            grouped.append({
                "start": current_start,
                "end": current_end,
                "text": text_so_far,
            })
            current_text = []
            current_start = None

    if current_text and current_start is not None:
        grouped.append({
            "start": current_start,
            "end": current_end,
            "text": " ".join(current_text),
        })

    return grouped


def _download_full_audio(sermon):
    """Download lightweight audio-only file (~5-15MB) for Whisper transcription."""
    tmp_dir = _sermon_tmp_dir(sermon.id)
    tmp_dir.mkdir(parents=True, exist_ok=True)

    options = {
        "format": "ba/ba*/bestaudio[ext=m4a]/bestaudio",
        "outtmpl": str(tmp_dir / "audio.%(ext)s"),
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "m4a",
            "preferredquality": "96",
        }],
        "extractor_args": {
            "youtube": {
                "player_client": ["ios", "mweb", "android"],
            }
        },
        "nocheckcertificate": True,
        "quiet": True,
        "no_warnings": True,
    }


    with yt_dlp.YoutubeDL(options) as ydl:
        info = ydl.extract_info(sermon.youtube_url, download=True)

    sermon.title = info.get("title") or sermon.title
    sermon.save(update_fields=["title", "updated_at"])

    audio_files = list(tmp_dir.glob("audio.*"))
    if not audio_files:
        raise FileNotFoundError(f"Audio file failed to download for sermon {sermon.id}")

    return audio_files[0]


@shared_task(bind=True)
def process_sermon(self, sermon_id):
    sermon = Sermon.objects.get(id=sermon_id)

    try:
        sermon.status = Sermon.Status.DOWNLOADING
        sermon.error_message = None
        sermon.save(update_fields=["status", "error_message", "updated_at"])

        yt_id = _extract_youtube_id(sermon.youtube_url)
        youtube_transcript = None

        if yt_id:
            try:
                logger.info("Attempting to fetch YouTube transcript for video %s...", yt_id)
                api = YouTubeTranscriptApi()
                try:
                    youtube_transcript = api.fetch(yt_id, languages=["en"])
                except Exception:
                    youtube_transcript = api.fetch(yt_id)
            except Exception as e:
                logger.info("YouTube transcript unavailable for %s: %s. Using Whisper audio transcription.", yt_id, str(e))

        raw_segments = []

        if youtube_transcript:
            try:
                with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True, "nocheckcertificate": True}) as ydl:
                    info = ydl.extract_info(sermon.youtube_url, download=False)
                    sermon.title = info.get("title") or sermon.title
                    sermon.save(update_fields=["title", "updated_at"])
            except Exception as e:
                logger.warning("Could not retrieve video metadata: %s", str(e))

            logger.info("Grouping YouTube subtitle segments into 35-45s sermon blocks...")
            grouped_segments = _group_youtube_transcript(youtube_transcript)

        else:
            # Whisper Audio Transcription Pipeline (Fast, audio-only ~10MB)
            logger.info("Downloading lightweight audio file for sermon %s...", sermon.id)
            audio_path = _download_full_audio(sermon)

            sermon.status = Sermon.Status.TRANSCRIBING
            sermon.save(update_fields=["status", "updated_at"])

            logger.info("Transcribing audio via Groq Whisper (whisper-large-v3-turbo)...")
            transcript_record = transcribe_sermon(sermon.id, audio_path=audio_path)

            if transcript_record.status == Transcript.Status.FAILED:
                raise RuntimeError(f"Whisper transcription failed: {transcript_record.error_message}")

            whisper_segments = transcript_record.segments or []
            grouped_segments = _group_whisper_segments(whisper_segments)

        # Generate full transcript text
        full_text = " ".join([seg["text"] for seg in grouped_segments])
        
        # Use LLM or smart heuristic to detect key moments with 100% context-accurate titles
        highlights = _detect_highlights_with_llm(grouped_segments, sermon_title=sermon.title)

        final_segments = []
        for idx, seg in enumerate(grouped_segments):
            is_hl = False
            hl_title = None
            for hl in highlights:
                hl_start = hl.get("start", 0)
                hl_end = hl.get("end", 0)
                if (seg["start"] >= hl_start - 10 and seg["start"] <= hl_end + 10) or (seg["end"] >= hl_start - 10 and seg["end"] <= hl_end + 10):
                    is_hl = True
                    hl_title = hl.get("title") or _generate_title_from_text(seg["text"])
                    break

            final_segments.append({
                "segment_index": idx,
                "start": seg["start"],
                "end": seg["end"],
                "text": seg["text"],
                "is_highlight": is_hl,
                "highlight_title": hl_title,
            })


        # Merge consecutive segments that share the same highlight title
        merged = []
        for seg in final_segments:
            if (
                merged
                and seg["is_highlight"]
                and merged[-1]["is_highlight"]
                and seg["highlight_title"]
                and seg["highlight_title"] == merged[-1].get("highlight_title")
            ):
                merged[-1]["end"] = seg["end"]
                merged[-1]["text"] = merged[-1]["text"] + " " + seg["text"]
            else:
                merged.append(seg)

        for idx, seg in enumerate(merged):
            seg["segment_index"] = idx

        final_segments = merged

        # Create or update Master Transcript record
        master_transcript, _ = Transcript.objects.get_or_create(sermon=sermon)
        master_transcript.raw_text = full_text
        master_transcript.segments = final_segments
        master_transcript.status = Transcript.Status.COMPLETE
        master_transcript.save()

        # Sync Sermon record
        sermon.transcript = full_text
        sermon.status = Sermon.Status.READY
        sermon.save(update_fields=["transcript", "status", "updated_at"])

        # Populate TranscriptSegment relations
        TranscriptSegment.objects.filter(sermon=sermon).delete()
        segment_objs = [
            TranscriptSegment(
                sermon=sermon,
                segment_index=idx,
                start_time=seg["start"],
                end_time=seg["end"],
                text=seg["text"],
            )
            for idx, seg in enumerate(final_segments)
        ]
        if segment_objs:
            TranscriptSegment.objects.bulk_create(segment_objs)

        logger.info("Successfully indexed sermon %s (%d segments, %d highlights).", sermon.id, len(final_segments), len(highlights))
        return {
            "sermon_id": str(sermon.id),
            "transcript_id": str(master_transcript.id),
            "segments_count": len(final_segments),
            "highlights_count": len(highlights),
        }

    except Exception as exc:
        sermon.status = Sermon.Status.FAILED
        sermon.error_message = str(exc)
        sermon.save(update_fields=["status", "error_message", "updated_at"])
        raise
    finally:
        _cleanup_tmp_dir(sermon_id)
