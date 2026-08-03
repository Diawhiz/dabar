from pathlib import Path
from django.core.management.base import BaseCommand, CommandError

from sermons.models import Sermon
from sermons.services.transcription import transcribe_sermon


class Command(BaseCommand):
    help = "Trigger Whisper transcription for a given Sermon ID"

    def add_arguments(self, parser):
        parser.add_argument("sermon_id", type=str, help="UUID of the Sermon record")
        parser.add_argument(
            "--audio",
            type=str,
            help="Optional path to local audio file (if omitted, downloads from YouTube)",
        )
        parser.add_argument(
            "--backend",
            type=str,
            choices=["groq", "local"],
            default="groq",
            help="Transcription backend to use (groq or local)",
        )

    def handle(self, *args, **options):
        sermon_id = options["sermon_id"]
        audio_path_str = options.get("audio")
        backend = options.get("backend", "groq")

        try:
            sermon = Sermon.objects.get(id=sermon_id)
        except Sermon.DoesNotExist:
            raise CommandError(f"Sermon with ID '{sermon_id}' does not exist.")

        audio_path = Path(audio_path_str) if audio_path_str else None

        self.stdout.write(
            self.style.NOTICE(f"Starting transcription for sermon '{sermon}' using backend '{backend}'...")
        )

        transcript = transcribe_sermon(sermon.id, audio_path=audio_path, backend_name=backend)

        if transcript.status == "complete":
            self.stdout.write(
                self.style.SUCCESS(
                    f"Successfully transcribed sermon {sermon.id}!\n"
                    f"Transcript ID: {transcript.id}\n"
                    f"Segments count: {len(transcript.segments)}\n"
                    f"Snippet: {transcript.raw_text[:120]}..."
                )
            )
        else:
            self.stderr.write(
                self.style.ERROR(
                    f"Transcription failed for sermon {sermon.id}: {transcript.error_message}"
                )
            )
