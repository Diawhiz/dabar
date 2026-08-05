import logging
import os
import subprocess
from abc import ABC, abstractmethod
from pathlib import Path
import requests
from decouple import config

from sermons.models import Sermon, Transcript, TranscriptSegment

logger = logging.getLogger(__name__)

GROQ_TRANSCRIPTION_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
MAX_FILE_SIZE_BYTES = 24 * 1024 * 1024  # 24 MB Groq file limit


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
    """Groq API implementation for Whisper transcription (whisper-large-v3-turbo)."""

    def __init__(self, api_key: str = None, model: str = "whisper-large-v3-turbo"):
        self.api_key = api_key or config("GROQ_API_KEY", default=None)
        self.model = model

    def _transcribe_single_file(self, audio_path: Path, time_offset: float = 0.0) -> dict:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
        }

        data = {
            "model": self.model,
            "response_format": "verbose_json",
            "language": "en",
        }

        with open(audio_path, "rb") as audio_file:
            files = {
                "file": (audio_path.name, audio_file, "audio/m4a"),
            }
            logger.info("Sending audio chunk %s to Groq Whisper (%s)...", audio_path.name, self.model)
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
                "start": round(float(seg.get("start", 0.0)) + time_offset, 2),
                "end": round(float(seg.get("end", 0.0)) + time_offset, 2),
                "text": str(seg.get("text", "")).strip(),
            })

        return {
            "text": raw_text,
            "segments": segments,
        }

    def transcribe(self, audio_file_path: Path) -> dict:
        if not self.api_key:
            raise ValueError(
                "GROQ_API_KEY environment variable is not configured. "
                "Please set GROQ_API_KEY in your .env file."
            )

        audio_file_path = Path(audio_file_path)
        if not audio_file_path.exists():
            raise FileNotFoundError(f"Audio file not found at: {audio_file_path}")

        file_size = audio_file_path.stat().st_size

        # If audio is under 24MB, transcribe directly in 1 request
        if file_size <= MAX_FILE_SIZE_BYTES:
            return self._transcribe_single_file(audio_file_path)

        # Large audio > 24MB: split into 10-minute chunks using ffmpeg
        logger.info("Audio file size (%d MB) exceeds 24MB limit. Chunking with ffmpeg...", file_size // (1024 * 1024))
        chunks_dir = audio_file_path.parent / "chunks"
        chunks_dir.mkdir(parents=True, exist_ok=True)

        chunk_pattern = str(chunks_dir / "chunk_%03d.m4a")
        cmd = [
            "ffmpeg", "-y", "-i", str(audio_file_path),
            "-f", "segment", "-segment_time", "600",
            "-c", "copy", chunk_pattern
        ]
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

        chunk_files = sorted(list(chunks_dir.glob("chunk_*.m4a")))
        all_text = []
        all_segments = []
        current_offset = 0.0

        for chunk_path in chunk_files:
            res = self._transcribe_single_file(chunk_path, time_offset=current_offset)
            all_text.append(res["text"])
            all_segments.extend(res["segments"])

            # Find duration of chunk to advance offset
            if res["segments"]:
                current_offset = res["segments"][-1]["end"]
            else:
                current_offset += 600.0

        # Clean up chunk directory
        import shutil
        shutil.rmtree(chunks_dir, ignore_errors=True)

        # Re-index merged segments
        for idx, seg in enumerate(all_segments):
            seg["segment_index"] = idx

        return {
            "text": " ".join(all_text),
            "segments": all_segments,
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
