import uuid

from django.db import models


class Sermon(models.Model):
    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        DOWNLOADING = "downloading", "Downloading"
        TRANSCRIBING = "transcribing", "Transcribing"
        DETECTING = "detecting", "Detecting"
        READY = "ready", "Ready"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    youtube_url = models.CharField(max_length=500)
    title = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.QUEUED,
    )
    transcript = models.TextField(blank=True, null=True)
    error_message = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title or str(self.youtube_url)


class Transcript(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        COMPLETE = "complete", "Complete"
        FAILED = "failed", "Failed"

    class Backend(models.TextChoices):
        GROQ = "groq", "Groq"
        LOCAL = "local", "Local"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sermon = models.ForeignKey(
        Sermon,
        related_name="transcripts",
        on_delete=models.CASCADE,
    )
    raw_text = models.TextField(blank=True, default="")
    segments = models.JSONField(default=list, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    backend_used = models.CharField(
        max_length=20,
        choices=Backend.choices,
        default=Backend.GROQ,
    )
    error_message = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Transcript ({self.backend_used}) - {self.sermon_id} [{self.status}]"


class TranscriptSegment(models.Model):
    sermon = models.ForeignKey(
        Sermon,
        related_name="segments",
        on_delete=models.CASCADE,
    )
    start_time = models.FloatField()
    end_time = models.FloatField()
    text = models.TextField()
    segment_index = models.IntegerField()

    class Meta:
        ordering = ["segment_index"]
        unique_together = ["sermon", "segment_index"]

    def __str__(self):
        return f"{self.sermon_id} segment {self.segment_index}"
