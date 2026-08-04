from django.urls import path

from .views import (
    ClipDownloadView,
    SermonDetailView,
    SermonListCreateView,
    SermonTranscribeView,
    SermonTranscriptDetailView,
)

urlpatterns = [
    path("sermons/", SermonListCreateView.as_view(), name="sermon-list"),
    path("sermons/<uuid:pk>/", SermonDetailView.as_view(), name="sermon-detail"),
    path("sermons/<uuid:pk>/transcribe/", SermonTranscribeView.as_view(), name="sermon-transcribe"),
    path("sermons/<uuid:pk>/transcript/", SermonTranscriptDetailView.as_view(), name="sermon-transcript"),
    path("clips/download/", ClipDownloadView.as_view(), name="clip-download"),
]
