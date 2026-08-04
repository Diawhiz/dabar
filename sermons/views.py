import threading
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Sermon, Transcript
from .serializers import SermonSerializer, TranscriptSerializer
from .services.transcription import transcribe_sermon


class SermonListCreateView(generics.ListCreateAPIView):
    queryset = Sermon.objects.all().order_by("-created_at")
    serializer_class = SermonSerializer

    def perform_create(self, serializer):
        sermon = serializer.save()
        from .tasks import process_sermon

        # Launch background processing thread so transcription starts immediately
        threading.Thread(
            target=process_sermon,
            args=(str(sermon.id),),
            daemon=True,
        ).start()


class SermonDetailView(generics.RetrieveAPIView):
    queryset = Sermon.objects.all()
    serializer_class = SermonSerializer


class SermonTranscribeView(APIView):
    """Trigger Whisper transcription for a specific sermon."""

    def post(self, request, pk, format=None):
        try:
            sermon = Sermon.objects.get(pk=pk)
        except Sermon.DoesNotExist:
            return Response(
                {"detail": "Sermon not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        backend_name = request.data.get("backend")
        transcript = transcribe_sermon(sermon.id, backend_name=backend_name)
        serializer = TranscriptSerializer(transcript)

        response_status = (
            status.HTTP_200_OK
            if transcript.status == Transcript.Status.COMPLETE
            else status.HTTP_500_INTERNAL_SERVER_ERROR
        )

        return Response(serializer.data, status=response_status)


class SermonTranscriptDetailView(APIView):
    """Retrieve the latest transcript and segment details for a sermon."""

    def get(self, request, pk, format=None):
        try:
            sermon = Sermon.objects.get(pk=pk)
        except Sermon.DoesNotExist:
            return Response(
                {"detail": "Sermon not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        transcript = sermon.transcripts.order_by("-created_at").first()
        if not transcript:
            return Response(
                {"detail": "No transcript available for this sermon yet."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = TranscriptSerializer(transcript)
        return Response(serializer.data, status=status.HTTP_200_OK)
