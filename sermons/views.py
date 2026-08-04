import logging
import shutil
import threading
from pathlib import Path

from django.http import FileResponse
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Sermon, Transcript
from .serializers import SermonSerializer, TranscriptSerializer
from .services.transcription import transcribe_sermon

try:
    import static_ffmpeg
    static_ffmpeg.add_paths()
except Exception:
    pass

logger = logging.getLogger(__name__)
TMP_CLIPS = Path(__file__).resolve().parent.parent / "tmp_clips"


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


class ClipDownloadView(APIView):
    """Download a specific time-range clip from a YouTube sermon as MP4."""

    def get(self, request, format=None):
        from django.http import HttpResponse

        youtube_url = request.query_params.get("url")
        start = request.query_params.get("start")
        end = request.query_params.get("end")

        if not youtube_url or start is None or end is None:
            return Response(
                {"detail": "url, start, and end query params are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            start_f = float(start)
            end_f = float(end)
        except (ValueError, TypeError):
            return Response(
                {"detail": "start and end must be valid numbers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        import uuid
        clip_id = uuid.uuid4().hex[:12]
        clip_dir = TMP_CLIPS / clip_id
        clip_dir.mkdir(parents=True, exist_ok=True)

        try:
            import yt_dlp

            options = {
                # DASH format is required for download_ranges to actually work.
                # With progressive/pre-merged mp4 (best[ext=mp4]), yt-dlp has to
                # download the ENTIRE video before it can cut — that's why it was
                # downloading the whole thing. DASH streams let yt-dlp fetch only
                # the byte segments for the requested time window.
                "format": "bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best",
                "outtmpl": str(clip_dir / "clip.%(ext)s"),
                "merge_output_format": "mp4",
                "download_ranges": lambda info_dict, ydl: [
                    {"start_time": start_f, "end_time": end_f}
                ],
                # False = no re-encode, just mux the DASH segments → very fast
                "force_keyframes_at_cuts": False,
                # Prevent .part temp files being mistaken for complete files
                "nopart": True,
                "extractor_args": {
                    "youtube": {
                        "player_client": ["ios", "mweb", "android"],
                    }
                },
                "nocheckcertificate": True,
                "quiet": True,
                "no_warnings": True,
            }

            with yt_dlp.YoutubeDL(options) as ydl:
                info = ydl.extract_info(youtube_url, download=True)

            # mp4 preferred; fall back to any output file
            output_files = list(clip_dir.glob("*.mp4")) or list(clip_dir.glob("clip.*"))

            if not output_files:
                return Response(
                    {"detail": "Clip download failed — no output file produced."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            clip_path = output_files[0]

            # Read entire file into memory BEFORE deleting temp dir.
            # This eliminates the race condition where cleanup() was running
            # while FileResponse was still mid-stream, corrupting the download.
            clip_bytes = clip_path.read_bytes()
            shutil.rmtree(clip_dir, ignore_errors=True)

            title_slug = (info.get("title") or "sermon-clip")[:50].replace(" ", "-").lower()
            filename = f"dabar-{title_slug}-{int(start_f)}s-{int(end_f)}s.mp4"

            response = HttpResponse(clip_bytes, content_type="video/mp4")
            response["Content-Disposition"] = f'attachment; filename="{filename}"'
            # Content-Length lets the browser show real download progress
            response["Content-Length"] = str(len(clip_bytes))
            return response

        except Exception as exc:
            logger.exception("Clip download failed: %s", str(exc))
            shutil.rmtree(clip_dir, ignore_errors=True)
            return Response(
                {"detail": f"Clip download failed: {str(exc)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
