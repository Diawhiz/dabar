from urllib.parse import urlparse

from rest_framework import serializers

from .models import Sermon, Transcript


YOUTUBE_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
    "www.youtu.be",
}


class TranscriptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transcript
        fields = [
            "id",
            "sermon",
            "raw_text",
            "segments",
            "status",
            "backend_used",
            "error_message",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "sermon",
            "raw_text",
            "segments",
            "status",
            "backend_used",
            "error_message",
            "created_at",
            "updated_at",
        ]


class SermonSerializer(serializers.ModelSerializer):
    transcripts = TranscriptSerializer(many=True, read_only=True)

    class Meta:
        model = Sermon
        fields = [
            "id",
            "youtube_url",
            "title",
            "status",
            "transcript",
            "transcripts",
            "error_message",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "title",
            "status",
            "transcript",
            "transcripts",
            "error_message",
            "created_at",
            "updated_at",
        ]

    def validate_youtube_url(self, value):
        parsed_url = urlparse(value)
        host = parsed_url.netloc.lower()

        if parsed_url.scheme not in {"http", "https"} or host not in YOUTUBE_HOSTS:
            raise serializers.ValidationError("Enter a valid YouTube URL.")

        if host in {"youtube.com", "www.youtube.com", "m.youtube.com"}:
            if parsed_url.path == "/watch" and parsed_url.query:
                return value
            if parsed_url.path.startswith(("/shorts/", "/embed/")):
                return value
            raise serializers.ValidationError("Enter a valid YouTube URL.")

        if host in {"youtu.be", "www.youtu.be"} and parsed_url.path.strip("/"):
            return value

        raise serializers.ValidationError("Enter a valid YouTube URL.")
