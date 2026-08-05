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


def _detect_highlights_with_llm(timestamped_segments):
    """
    Use a large LLM to identify the most powerful key moments in a sermon.

    Previous approach failed because:
    1. The LLM received flat text with NO timestamps, so it guessed start/end values
    2. The 8B model was too small for nuanced sermon understanding
    3. Transcript was truncated at 15K chars, missing the second half

    Fix:
    - Send timestamped [start-end] segments so the LLM can cite real timestamps
    - Use llama-3.3-70b-versatile (free on Groq, 128K context, much smarter)
    - Send the full transcript
    """
    api_key = config("GROQ_API_KEY", default=None)
    if not api_key or not timestamped_segments:
        return []

    # Build a timestamped transcript the LLM can reference precisely
    # Format: "[00:00 - 00:35] The text of this segment..."
    lines = []
    for seg in timestamped_segments:
        s_min, s_sec = divmod(int(seg["start"]), 60)
        e_min, e_sec = divmod(int(seg["end"]), 60)
        ts = f"[{s_min:02d}:{s_sec:02d} - {e_min:02d}:{e_sec:02d}]"
        lines.append(f"{ts} {seg['text']}")

    timestamped_text = "\n\n".join(lines)

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    prompt = (
        "You are a senior church media strategist who produces viral sermon clips for social media.\n\n"
        "Below is a FULL sermon transcript with timestamps. Your job is to find the 3 to 6 most "
        "powerful, shareable moments — the kind that make someone stop scrolling and share.\n\n"
        "Look for these types of moments:\n"
        "- **Core Message / Main Point**: The central thesis or revelation the preacher drives home\n"
        "- **Conviction Moments**: When the preacher challenges the congregation directly\n"
        "- **Gospel Invitations**: Altar calls, salvation prayers, calls to surrender\n"
        "- **Powerful Illustrations**: Stories, analogies, or metaphors that land emotionally\n"
        "- **Declaration / Prophetic Words**: Bold faith declarations the audience repeats\n"
        "- **Worship Transitions**: When preaching flows into worship or prayer\n\n"
        "RULES:\n"
        "- Each highlight MUST be 30-90 seconds long (a complete thought, not a fragment)\n"
        "- Use the EXACT timestamps from the transcript — do NOT invent timestamps\n"
        "- Pick the start timestamp of the FIRST segment and end timestamp of the LAST segment "
        "that together form the complete moment\n"
        "- The highlights should cover the MAIN message of the sermon, not just random side points\n"
        "- If the preacher repeats a key phrase multiple times, pick the most impactful delivery\n\n"
        "Respond ONLY with this JSON format:\n"
        '{"highlights": [\n'
        '  {"title": "Short Clip Title", "start": 120.0, "end": 185.0, '
        '"reason": "Why this moment is powerful and shareable"}\n'
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
        response = requests.post(GROQ_COMPLETIONS_URL, headers=headers, json=data, timeout=60)
        if response.ok:
            content = response.json()["choices"][0]["message"]["content"]
            result = json.loads(content)
            highlights = result.get("highlights", [])
            logger.info("LLM detected %d key moments in sermon.", len(highlights))
            return highlights
        else:
            logger.warning("LLM API returned %d: %s", response.status_code, response.text[:200])
    except Exception as e:
        logger.warning("LLM highlight detection failed: %s", str(e))
    return []


def _group_youtube_transcript(yt_transcript):
    """
    Group short raw YouTube subtitle snippets into substantial ~35-45 second paragraph blocks
    representing complete sermon thoughts rather than fragmented 2-second lines.
    """
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

        # Create substantial sermon blocks (~35-45s)
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
    tmp_dir = _sermon_tmp_dir(sermon.id)
    tmp_dir.mkdir(parents=True, exist_ok=True)

    options = {
        "format": "m4a/bestaudio/best",
        "outtmpl": str(tmp_dir / "audio.%(ext)s"),
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
                logger.info("Attempting to fetch full YouTube transcript for video %s...", yt_id)
                api = YouTubeTranscriptApi()
                youtube_transcript = api.fetch(yt_id, languages=["en"])
            except Exception as e:
                logger.info("YouTube transcript unavailable: %s. Falling back to full download.", str(e))

        if youtube_transcript:
            # Fetch metadata to get video title
            try:
                with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True, "nocheckcertificate": True}) as ydl:
                    info = ydl.extract_info(sermon.youtube_url, download=False)
                    sermon.title = info.get("title") or sermon.title
                    sermon.save(update_fields=["title", "updated_at"])
            except Exception as e:
                logger.warning("Could not retrieve video metadata: %s", str(e))

            logger.info("Grouping YouTube subtitle segments into substantial 35-45s sermon blocks...")
            grouped_segments = _group_youtube_transcript(youtube_transcript)

            # Generate full transcript text
            full_text = " ".join([seg["text"] for seg in grouped_segments])
            
            # Use 70B LLM with timestamped segments to detect key moments accurately
            highlights = _detect_highlights_with_llm(grouped_segments)
            
            final_segments = []
            for idx, seg in enumerate(grouped_segments):
                # Check if segment falls within any LLM detected highlight window
                is_hl = False
                hl_title = None
                for hl in highlights:
                    hl_start = hl.get("start", 0)
                    hl_end = hl.get("end", 0)
                    if (seg["start"] >= hl_start - 10 and seg["start"] <= hl_end) or (seg["end"] >= hl_start and seg["end"] <= hl_end + 10):
                        is_hl = True
                        hl_title = hl.get("title")
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
            # so one key moment doesn't get split across multiple cards
            merged = []
            for seg in final_segments:
                if (
                    merged
                    and seg["is_highlight"]
                    and merged[-1]["is_highlight"]
                    and seg["highlight_title"]
                    and seg["highlight_title"] == merged[-1].get("highlight_title")
                ):
                    # Extend the previous segment's time range and append text
                    merged[-1]["end"] = seg["end"]
                    merged[-1]["text"] = merged[-1]["text"] + " " + seg["text"]
                else:
                    merged.append(seg)

            # Re-index after merging
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

            logger.info("Successfully indexed full sermon %s (%d total segments).", sermon.id, len(final_segments))
            return {
                "sermon_id": str(sermon.id),
                "transcript_id": str(master_transcript.id),
                "segments_count": len(final_segments),
                "highlights_count": len(highlights),
            }

        else:
            # Fallback: Full Audio Downloader + Whisper Transcription
            logger.info("Starting fallback full audio download pipeline...")
            audio_path = _download_full_audio(sermon)

            sermon.status = Sermon.Status.TRANSCRIBING
            sermon.save(update_fields=["status", "updated_at"])

            transcript = transcribe_sermon(sermon.id, audio_path=audio_path)

            if transcript.status == Transcript.Status.FAILED:
                raise RuntimeError(f"Transcription failed: {transcript.error_message}")

            sermon.status = Sermon.Status.READY
            sermon.transcript = transcript.raw_text
            sermon.save(update_fields=["status", "transcript", "updated_at"])

            return {
                "sermon_id": str(sermon.id),
                "transcript_id": str(transcript.id),
                "segments_count": len(transcript.segments),
            }

    except Exception as exc:
        sermon.status = Sermon.Status.FAILED
        sermon.error_message = str(exc)
        sermon.save(update_fields=["status", "error_message", "updated_at"])
        raise
    finally:
        _cleanup_tmp_dir(sermon_id)
