from pathlib import Path
from unittest.mock import MagicMock, patch

from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Sermon, Transcript, TranscriptSegment
from .services.transcription import GroqWhisperBackend, transcribe_sermon


class SermonAPITests(APITestCase):
    def test_create_sermon_with_youtube_url(self):
        response = self.client.post(
            reverse("sermon-list"),
            {"youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], Sermon.Status.QUEUED)
        self.assertEqual(
            response.data["youtube_url"],
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        )
        self.assertIsNone(response.data["title"])
        self.assertIsNone(response.data["transcript"])
        self.assertIsNone(response.data["error_message"])

    def test_rejects_non_youtube_url(self):
        response = self.client.post(
            reverse("sermon-list"),
            {"youtube_url": "https://example.com/watch?v=dQw4w9WgXcQ"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("youtube_url", response.data)

    def test_lists_sermons_newest_first(self):
        older_sermon = Sermon.objects.create(youtube_url="https://youtu.be/older")
        newer_sermon = Sermon.objects.create(youtube_url="https://youtu.be/newer")

        response = self.client.get(reverse("sermon-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]["id"], str(newer_sermon.id))
        self.assertEqual(response.data[1]["id"], str(older_sermon.id))

    def test_retrieves_sermon_detail(self):
        sermon = Sermon.objects.create(
            youtube_url="https://www.youtube.com/shorts/dQw4w9WgXcQ",
            transcript="Test transcript",
        )

        response = self.client.get(reverse("sermon-detail", kwargs={"pk": sermon.id}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], str(sermon.id))
        self.assertEqual(response.data["status"], Sermon.Status.QUEUED)
        self.assertEqual(response.data["transcript"], "Test transcript")


class TranscriptionServiceTests(TestCase):
    def setUp(self):
        self.sermon = Sermon.objects.create(
            youtube_url="https://www.youtube.com/watch?v=test_sermon_123",
            title="Test Sermon Title",
        )

    @patch("sermons.services.transcription.requests.post")
    def test_groq_whisper_backend_success(self, mock_post):
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.json.return_value = {
            "text": "God develops depth before visibility.",
            "segments": [
                {"start": 0.0, "end": 4.5, "text": "God develops depth"},
                {"start": 4.5, "end": 8.0, "text": "before visibility."},
            ],
        }
        mock_post.return_value = mock_response

        backend = GroqWhisperBackend(api_key="mock_groq_key")
        
        # Mocking an existing audio file path
        with patch.object(Path, "exists", return_value=True), patch("builtins.open", MagicMock()):
            result = backend.transcribe(Path("/tmp/fake_audio.mp3"))

        self.assertEqual(result["text"], "God develops depth before visibility.")
        self.assertEqual(len(result["segments"]), 2)
        self.assertEqual(result["segments"][0]["start"], 0.0)
        self.assertEqual(result["segments"][0]["end"], 4.5)
        self.assertEqual(result["segments"][0]["text"], "God develops depth")

    @patch("sermons.services.transcription.GroqWhisperBackend.transcribe")
    def test_transcribe_sermon_service_creates_transcript(self, mock_transcribe):
        mock_transcribe.return_value = {
            "text": "Faithfulness is still fruit.",
            "segments": [
                {"segment_index": 0, "start": 0.0, "end": 3.2, "text": "Faithfulness is still fruit."}
            ],
        }

        transcript = transcribe_sermon(self.sermon.id, backend_name="groq")

        self.assertEqual(transcript.status, Transcript.Status.COMPLETE)
        self.assertEqual(transcript.raw_text, "Faithfulness is still fruit.")
        self.assertEqual(transcript.backend_used, Transcript.Backend.GROQ)
        self.assertEqual(len(transcript.segments), 1)

        # Check Sermon update
        self.sermon.refresh_from_db()
        self.assertEqual(self.sermon.status, Sermon.Status.READY)
        self.assertEqual(self.sermon.transcript, "Faithfulness is still fruit.")

        # Check TranscriptSegment model creation
        segments = TranscriptSegment.objects.filter(sermon=self.sermon)
        self.assertEqual(segments.count(), 1)
        self.assertEqual(segments.first().text, "Faithfulness is still fruit.")

    @patch("sermons.services.transcription.GroqWhisperBackend.transcribe")
    def test_transcribe_sermon_service_handles_failure_gracefully(self, mock_transcribe):
        mock_transcribe.side_effect = RuntimeError("Groq API 500 Server Error")

        transcript = transcribe_sermon(self.sermon.id, backend_name="groq")

        self.assertEqual(transcript.status, Transcript.Status.FAILED)
        self.assertEqual(transcript.error_message, "Groq API 500 Server Error")

        self.sermon.refresh_from_db()
        self.assertEqual(self.sermon.status, Sermon.Status.FAILED)
        self.assertEqual(self.sermon.error_message, "Groq API 500 Server Error")

    @patch("sermons.views.transcribe_sermon")
    def test_transcribe_api_endpoint(self, mock_transcribe):
        mock_transcript = Transcript.objects.create(
            sermon=self.sermon,
            raw_text="Sample text",
            status=Transcript.Status.COMPLETE,
        )
        mock_transcribe.return_value = mock_transcript

        url = reverse("sermon-transcribe", kwargs={"pk": self.sermon.id})
        response = self.client.post(url, {"backend": "groq"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["raw_text"], "Sample text")
        self.assertEqual(response.data["status"], "complete")

    @patch("sermons.management.commands.transcribe_sermon.transcribe_sermon")
    def test_transcribe_management_command(self, mock_transcribe):
        mock_transcript = Transcript.objects.create(
            sermon=self.sermon,
            raw_text="Management command text",
            status=Transcript.Status.COMPLETE,
            segments=[{"segment_index": 0, "start": 0, "end": 2, "text": "Management command text"}],
        )
        mock_transcribe.return_value = mock_transcript

        call_command("transcribe_sermon", str(self.sermon.id), "--backend", "groq")
        mock_transcribe.assert_called_once()

    def test_get_transcript_detail_endpoint(self):
        Transcript.objects.create(
            sermon=self.sermon,
            raw_text="Detailed transcript text",
            status=Transcript.Status.COMPLETE,
            segments=[{"segment_index": 0, "start": 0.0, "end": 2.5, "text": "Detailed transcript text"}],
        )

        url = reverse("sermon-transcript", kwargs={"pk": self.sermon.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["raw_text"], "Detailed transcript text")
        self.assertEqual(len(response.data["segments"]), 1)

