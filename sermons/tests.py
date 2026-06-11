from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Sermon


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
