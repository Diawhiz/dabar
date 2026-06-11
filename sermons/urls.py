from django.urls import path

from .views import SermonDetailView, SermonListCreateView

urlpatterns = [
    path("sermons/", SermonListCreateView.as_view(), name="sermon-list"),
    path("sermons/<uuid:pk>/", SermonDetailView.as_view(), name="sermon-detail"),
]
