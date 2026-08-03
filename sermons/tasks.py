import shutil
from pathlib import Path

import yt_dlp
from celery import shared_task

from .models import Sermon, Transcript
from .services.transcription import transcribe_sermon


TMP_ROOT = Path("/tmp/dabar")


def _sermon_tmp_dir(sermon_id):
    return TMP_ROOT / str(sermon_id)


def _cleanup_tmp_dir(sermon_id):
    shutil.rmtree(_sermon_tmp_dir(sermon_id), ignore_errors=True)


def _download_audio(sermon):
    tmp_dir = _sermon_tmp_dir(sermon.id)
    tmp_dir.mkdir(parents=True, exist_ok=True)
    audio_path = tmp_dir / "audio.mp3"

    options = {
        "format": "bestaudio/best",
        "outtmpl": str(tmp_dir / "audio.%(ext)s"),
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }
        ],
        "quiet": True,
        "no_warnings": True,
    }

    with yt_dlp.YoutubeDL(options) as ydl:
        info = ydl.extract_info(sermon.youtube_url, download=True)

    sermon.title = info.get("title") or sermon.title
    sermon.save(update_fields=["title", "updated_at"])

    return audio_path


@shared_task(bind=True)
def process_sermon(self, sermon_id):
    sermon = Sermon.objects.get(id=sermon_id)

    try:
        sermon.status = Sermon.Status.DOWNLOADING
        sermon.error_message = None
        sermon.save(update_fields=["status", "error_message", "updated_at"])

        audio_path = _download_audio(sermon)

        # Execute Whisper transcription pipeline stage
        transcript = transcribe_sermon(sermon.id, audio_path=audio_path)

        if transcript.status == Transcript.Status.FAILED:
            raise RuntimeError(f"Transcription stage failed: {transcript.error_message}")

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
