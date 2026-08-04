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
from .models import Sermon, Transcript
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
        "You are an expert sermon content strategist. Analyze the following transcript from a sermon. "
        "Select up to 3 key highlights containing the most theological weight, conviction, or memorable illustrations. "
        "Each highlight must be a contiguous range of time. Provide a short title and the exact start and end times in seconds. "
        "You MUST respond ONLY with a JSON object in this format:\n"
        "{\n"
        '  "highlights": [\n'
        '    {"title": "Title of moment", "start": 120.0, "end": 180.0, "reason": "Description of why this is a good moment"}\n'
        "  ]\n"
        "}\n\n"
        f"Transcript:\n{transcript_text}"
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


def _download_audio_slice(sermon, start_time, end_time, index):
    tmp_dir = _sermon_tmp_dir(sermon.id)
    tmp_dir.mkdir(parents=True, exist_ok=True)

    options = {
        "format": "m4a/bestaudio/best",
        "outtmpl": str(tmp_dir / f"slice_{index}.%(ext)s"),
        "extractor_args": {
            "youtube": {
                "player_client": ["ios", "mweb", "android"],
            }
        },
        "nocheckcertificate": True,
        "quiet": True,
        "no_warnings": True,
        "download_ranges": lambda info_dict, self: [{"start_time": start_time, "end_time": end_time}],
    }

    with yt_dlp.YoutubeDL(options) as ydl:
        ydl.extract_info(sermon.youtube_url, download=True)

    slice_files = list(tmp_dir.glob(f"slice_{index}.*"))
    if not slice_files:
        raise FileNotFoundError(f"Slice download failed for range {start_time}-{end_time}")

    return slice_files[0]


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
                logger.info("Attempting to fetch YouTube transcript for video %s...", yt_id)
                api = YouTubeTranscriptApi()
                youtube_transcript = api.fetch(yt_id, languages=["en"])
            except Exception as e:
                logger.info("YouTube transcript unavailable: %s. Falling back to full download.", str(e))

        if youtube_transcript:
            # Fetch metadata first to get video title
            try:
                with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True, "nocheckcertificate": True}) as ydl:
                    info = ydl.extract_info(sermon.youtube_url, download=False)
                    sermon.title = info.get("title") or sermon.title
                    sermon.save(update_fields=["title", "updated_at"])
            except Exception as e:
                logger.warning("Could not retrieve video metadata: %s", str(e))

            logger.info("Successfully fetched YouTube transcript. Mapping text for LLM highlight detection...")
            
            # Format text segments for LLM analysis
            transcript_text = "\n".join(
                f"[{item.start:.1f}s - {item.start + item.duration:.1f}s]: {item.text}"
                for item in youtube_transcript
            )

            # Detect highlights/sections
            highlights = _detect_highlights_with_llm(transcript_text)
            if not highlights:
                # Default to extracting first 60 seconds if LLM fails
                highlights = [{"title": "Opening Clip", "start": 0.0, "end": 60.0}]

            logger.info("Detected %d highlight windows. Proceeding with targeted audio download...", len(highlights))
            
            merged_segments = []
            merged_raw_text = []

            for idx, hl in enumerate(highlights):
                start = hl["start"]
                end = hl["end"]
                title = hl["title"]

                logger.info("Downloading targeted audio range for highlight '%s' (%s to %s seconds)...", title, start, end)
                slice_path = _download_audio_slice(sermon, start, end, idx)

                # Whisper-transcribe ONLY the sliced audio file to get high-fidelity punctuation & text
                transcript_obj = transcribe_sermon(sermon.id, audio_path=slice_path)
                
                if transcript_obj.status == Transcript.Status.COMPLETE:
                    # Adjust transcribed segment start/end times relative to actual video
                    for seg in transcript_obj.segments:
                        adjusted_start = start + seg["start"]
                        adjusted_end = start + seg["end"]
                        merged_segments.append({
                            "segment_index": len(merged_segments),
                            "start": adjusted_start,
                            "end": adjusted_end,
                            "text": seg["text"],
                            "highlight_title": title,
                        })
                    merged_raw_text.append(transcript_obj.raw_text)

            # Update master Transcript record with compiled targeted segments
            master_transcript, _ = Transcript.objects.get_or_create(sermon=sermon)
            master_transcript.raw_text = " ... ".join(merged_raw_text)
            master_transcript.segments = merged_segments
            master_transcript.status = Transcript.Status.COMPLETE
            master_transcript.save()

            sermon.transcript = master_transcript.raw_text
            sermon.status = Sermon.Status.READY
            sermon.save(update_fields=["transcript", "status", "updated_at"])

            logger.info("Hybrid Targeted Whisper pipeline completed successfully for sermon %s.", sermon.id)
            return {
                "sermon_id": str(sermon.id),
                "transcript_id": str(master_transcript.id),
                "segments_count": len(merged_segments),
                "hybrid": True,
            }

        else:
            # Option Fallback: Full Audio Downloader + Whisper Transcription
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
                "hybrid": False,
            }

    except Exception as exc:
        sermon.status = Sermon.Status.FAILED
        sermon.error_message = str(exc)
        sermon.save(update_fields=["status", "error_message", "updated_at"])
        raise
    finally:
        _cleanup_tmp_dir(sermon_id)
