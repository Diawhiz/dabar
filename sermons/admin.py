from django.contrib import admin

from .models import Sermon


@admin.register(Sermon)
class SermonAdmin(admin.ModelAdmin):
    list_display = ("id", "youtube_url", "status", "created_at", "updated_at")
    list_filter = ("status", "created_at", "updated_at")
    search_fields = ("youtube_url", "title", "transcript")
    readonly_fields = ("id", "created_at", "updated_at")
