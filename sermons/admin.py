from django.contrib import admin

from .models import Sermon, TranscriptSegment


@admin.register(Sermon)
class SermonAdmin(admin.ModelAdmin):
    list_display = ("id", "youtube_url", "status", "created_at", "updated_at")
    list_filter = ("status", "created_at", "updated_at")
    search_fields = ("youtube_url", "title", "transcript")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(TranscriptSegment)
class TranscriptSegmentAdmin(admin.ModelAdmin):
    list_display = ("sermon", "segment_index", "start_time", "end_time")
    list_filter = ("sermon",)
    search_fields = ("text", "sermon__youtube_url", "sermon__title")
