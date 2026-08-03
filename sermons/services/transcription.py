import logging
import os
from abc import ABC, abstractmethod
from pathlib import Path
import requests
from decouple import config

from sermons.models import Sermon, Transcript, TranscriptSegment

logger = logging.getLogger(__name__)

GROQ_TRANSCRIPTION_URL = "https://api.groq.com/openai/v1/audio/transcriptions"


class BaseTranscriptionBackend(ABC):
    """Abstract interface for Whisper transcription backends."""

    @abstractmethod
    def transcribe(self, audio_file_path: Path) -> dict:
        """
        Transcribe an audio file and return a dictionary with:
        {
            "text": "Full raw transcript text",
            "segments": [
                {"start": 0.0, "end": 4.5, "text": "Segment text..."},
                ...
            ]
        }
        """
        pass


class GroqWhisperBackend(BaseTranscriptionBackend):
    """Groq API implementation for Whisper transcription (whisper-large-v3)."""

    def __init__(self, api_key: str = None, model: str = "whisper-large-v3"):
        self.api_key = api_key or config("GROQ_API_KEY", default=None)
        self.model = model

    def transcribe(self, audio_file_path: Path) -> dict:
        if not self.api_key:
            raise ValueError(
                "GROQ_API_KEY environment variable is not configured. "
                "Please set GROQ_API_KEY in your .env file."
            )

        audio_file_path = Path(audio_file_path)
        if not audio_file_path.exists():
            raise FileNotFoundError(f"Audio file not found at: {audio_file_path}")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
        }

        data = {
            "model": self.model,
            "response_format": "verbose_json",
        }

        with open(audio_file_path, "rb") as audio_file:
            files = {
                "file": (audio_file_path.name, audio_file, "audio/mpeg"),
            }
            logger.info("Sending audio to Groq Whisper API model %s...", self.model)
            response = requests.post(
                GROQ_TRANSCRIPTION_URL,
                headers=headers,
                data=data,
                files=files,
                timeout=300,
            )

        if not response.ok:
            error_detail = response.text
            logger.error("Groq API error (%d): %s", response.status_code, error_detail)
            raise RuntimeError(f"Groq API returned HTTP {response.status_code}: {error_detail}")

        payload = response.json()
        raw_text = payload.get("text", "").strip()
        raw_segments = payload.get("segments", [])

        segments = []
        for idx, seg in enumerate(raw_segments):
            segments.append({
                "segment_index": idx,
                "start": float(seg.get("start", 0.0)),
                "end": float(seg.get("end", 0.0)),
                "text": str(seg.get("text", "")).strip(),
            })

        return {
            "text": raw_text,
            "segments": segments,
        }


class LocalWhisperBackend(BaseTranscriptionBackend):
    """Extension fallback for local faster-whisper / whisper.cpp."""

    def __init__(self, model_size: str = None):
        self.model_size = model_size or config("WHISPER_MODEL_SIZE", default="base")

    def transcribe(self, audio_file_path: Path) -> dict:
        raise NotImplementedError(
            "Local Whisper backend is not enabled. "
            "Please set TRANSCRIPTION_BACKEND=groq in your .env file."
        )


def get_transcription_backend(backend_name: str = None) -> BaseTranscriptionBackend:
    name = (backend_name or config("TRANSCRIPTION_BACKEND", default="groq")).lower().strip()
    if name == "groq":
        return GroqWhisperBackend()
    elif name == "local":
        return LocalWhisperBackend()
    else:
        raise ValueError(f"Unsupported TRANSCRIPTION_BACKEND: '{name}'. Allowed values are 'groq' or 'local'.")


def transcribe_sermon(sermon_id, audio_path: Path = None, backend_name: str = None) -> Transcript:
    """
    Service entry point to transcribe a sermon:
    1. Fetches Sermon record.
    2. Instantiates/updates Transcript record (status=PROCESSING).
    3. Runs configured transcription backend.
    4. Saves raw_text and segment JSON to Transcript (status=COMPLETE).
    5. Syncs Sermon.transcript and TranscriptSegment models for compatibility.
    6. Handles and logs failures gracefully without crashing.
    """
    sermon = Sermon.objects.get(id=sermon_id)

    backend_type = (backend_name or config("TRANSCRIPTION_BACKEND", default="groq")).lower().strip()
    transcript, _ = Transcript.objects.get_or_create(
        sermon=sermon,
        defaults={
            "status": Transcript.Status.PROCESSING,
            "backend_used": backend_type,
        },
    )
    transcript.status = Transcript.Status.PROCESSING
    transcript.backend_used = backend_type
    transcript.error_message = None
    transcript.save(update_fields=["status", "backend_used", "error_message", "updated_at"])

    sermon.status = Sermon.Status.TRANSCRIBING
    sermon.error_message = None
    sermon.save(update_fields=["status", "error_message", "updated_at"])

    try:
        backend = get_transcription_backend(backend_type)
        result = backend.transcribe(audio_path)

        raw_text = result.get("text", "")
        segments = result.get("segments", [])

        # Update Transcript record
        transcript.raw_text = raw_text
        transcript.segments = segments
        transcript.status = Transcript.Status.COMPLETE
        transcript.save(update_fields=["raw_text", "segments", "status", "updated_at"])

        # Sync back to Sermon model & TranscriptSegment relations
        sermon.transcript = raw_text
        sermon.status = Sermon.Status.READY
        sermon.save(update_fields=["transcript", "status", "updated_at"])

        # Populate TranscriptSegment records
        TranscriptSegment.objects.filter(sermon=sermon).delete()
        segment_objs = [
            TranscriptSegment(
                sermon=sermon,
                segment_index=seg.get("segment_index", idx),
                start_time=seg.get("start", 0.0),
                end_time=seg.get("end", 0.0),
                text=seg.get("text", ""),
            )
            for idx, seg in enumerate(segments)
        ]
        if segment_objs:
            TranscriptSegment.objects.bulk_create(segment_objs)

        logger.info("Successfully transcribed sermon %s (%d segments).", sermon.id, len(segments))
        return transcript

    except Exception as exc:
        error_msg = str(exc)
        logger.exception("Transcription failed for sermon %s: %s", sermon.id, error_msg)

        transcript.status = Transcript.Status.FAILED
        transcript.error_message = error_msg
        transcript.save(update_fields=["status", "error_message", "updated_at"])

        sermon.status = Sermon.Status.FAILED
        sermon.error_message = error_msg
        sermon.save(update_fields=["status", "error_message", "updated_at"])

        return transcript
