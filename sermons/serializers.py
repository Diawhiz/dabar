from urllib.parse import urlparse

from rest_framework import serializers

from .models import Sermon


YOUTUBE_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
    "www.youtu.be",
}


class SermonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sermon
        fields = [
            "id",
            "youtube_url",
            "title",
            "status",
            "transcript",
            "error_message",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "title",
            "status",
            "transcript",
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
