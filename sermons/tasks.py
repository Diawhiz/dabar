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


def _detect_highlights_with_llm(transcript_text):
    api_key = config("GROQ_API_KEY", default=None)
    if not api_key:
        return []

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    prompt = (
        "You are an expert sermon content strategist. Analyze the following full transcript from a sermon. "
        "Identify 3 to 5 substantial, high-impact key moments (each between 30 and 75 seconds long) containing "
        "complete theological thoughts, invitations, or memorable illustrations suitable for 9:16 social media clips. "
        "Avoid short 2-second snippets; ensure start and end span a complete 30-75 second preaching passage. "
        "You MUST respond ONLY with a JSON object in this format:\n"
        "{\n"
        '  "highlights": [\n'
        '    {"title": "Title of key moment", "start": 120.0, "end": 175.0, "reason": "Why this moment is powerful"}\n'
        "  ]\n"
        "}\n\n"
        f"Transcript:\n{transcript_text[:15000]}"
    )

    data = {
        "model": "llama-3.1-8b-instant",
        "messages": [
            {"role": "system", "content": "You are a JSON assistant. Respond with valid JSON only."},
            {"role": "user", "content": prompt}
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
    }

    try:
        response = requests.post(GROQ_COMPLETIONS_URL, headers=headers, json=data, timeout=30)
        if response.ok:
            content = response.json()["choices"][0]["message"]["content"]
            result = json.loads(content)
            return result.get("highlights", [])
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
            
            # Use LLM to detect substantial 30-75s key highlights across the transcript
            highlights = _detect_highlights_with_llm(full_text)
            
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
