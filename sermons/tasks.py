import shutil
from pathlib import Path

import yt_dlp
from celery import shared_task

from .models import Sermon, Transcript
from .services.transcription import transcribe_sermon


TMP_ROOT = Path(__file__).resolve().parent.parent / "tmp_audio"


def _sermon_tmp_dir(sermon_id):
    return TMP_ROOT / str(sermon_id)


def _cleanup_tmp_dir(sermon_id):
    shutil.rmtree(_sermon_tmp_dir(sermon_id), ignore_errors=True)


def _download_audio(sermon):
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

    # Locate downloaded audio file in tmp_dir
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

        audio_path = _download_audio(sermon)

        sermon.status = Sermon.Status.TRANSCRIBING
        sermon.save(update_fields=["status", "updated_at"])

        # Execute Whisper transcription pipeline stage
        transcript = transcribe_sermon(sermon.id, audio_path=audio_path)

        if transcript.status == Transcript.Status.FAILED:
            raise RuntimeError(f"Transcription stage failed: {transcript.error_message}")

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
