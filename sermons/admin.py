from django.contrib import admin

from .models import Sermon, Transcript, TranscriptSegment


@admin.register(Sermon)
class SermonAdmin(admin.ModelAdmin):
    list_display = ("id", "youtube_url", "title", "status", "created_at", "updated_at")
    list_filter = ("status", "created_at", "updated_at")
    search_fields = ("youtube_url", "title", "transcript")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(Transcript)
class TranscriptAdmin(admin.ModelAdmin):
    list_display = ("id", "sermon", "status", "backend_used", "created_at", "updated_at")
    list_filter = ("status", "backend_used", "created_at", "updated_at")
    search_fields = ("raw_text", "sermon__youtube_url", "sermon__title")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(TranscriptSegment)
class TranscriptSegmentAdmin(admin.ModelAdmin):
    list_display = ("sermon", "segment_index", "start_time", "end_time")
    list_filter = ("sermon",)
    search_fields = ("text", "sermon__youtube_url", "sermon__title")
