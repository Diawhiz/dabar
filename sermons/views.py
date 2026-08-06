import logging
import shutil
import subprocess
import threading
from pathlib import Path

from django.http import FileResponse, HttpResponse
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

        # Guarantee at least 3-5 highlights exist in response
        if transcript.segments:
            has_hl = any(seg.get("is_highlight") for seg in transcript.segments)
            if not has_hl:
                from .tasks import _fallback_heuristic_highlights
                hl_moments = _fallback_heuristic_highlights(transcript.segments)
                for seg in transcript.segments:
                    for hl in hl_moments:
                        if abs(float(seg.get("start", 0)) - hl["start"]) < 10:
                            seg["is_highlight"] = True
                            seg["highlight_title"] = hl["title"]
                            break
                transcript.save(update_fields=["segments"])

        serializer = TranscriptSerializer(transcript)
        return Response(serializer.data, status=status.HTTP_200_OK)



class ClipDownloadView(APIView):
    """Download a specific time-range clip from a YouTube sermon as MP4 without fetching the full video."""

    def get(self, request, format=None):
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

        import hashlib
        import uuid
        from django.core.cache import cache

        clip_id = uuid.uuid4().hex[:12]
        clip_dir = TMP_CLIPS / clip_id
        clip_dir.mkdir(parents=True, exist_ok=True)

        url_hash = hashlib.md5(youtube_url.encode("utf-8")).hexdigest()
        cache_key = f"yt_stream_info_{url_hash}"

        try:
            import yt_dlp

            # 1. Fetch direct YouTube stream HTTP URLs (or retrieve from 2-hour cache for instant response)
            info = cache.get(cache_key)
            if not info:
                options = {
                    "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best",
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
                    info = ydl.extract_info(youtube_url, download=False)
                if info:
                    cache.set(cache_key, info, timeout=7200)

            out_mp4 = clip_dir / "clip.mp4"
            requested_formats = info.get("requested_formats") or []
            headers_dict = info.get("http_headers") or {}
            headers_str = "".join([f"{k}: {v}\r\n" for k, v in headers_dict.items()])

            # 2. Ultra-fast lossless stream copy (-c copy) directly from YouTube HTTP streams with headers
            if len(requested_formats) >= 2:
                v_url = requested_formats[0]["url"]
                a_url = requested_formats[1]["url"]
                cmd = [
                    "ffmpeg", "-y",
                    "-headers", headers_str,
                    "-ss", str(start_f), "-to", str(end_f), "-i", v_url,
                    "-headers", headers_str,
                    "-ss", str(start_f), "-to", str(end_f), "-i", a_url,
                    "-c", "copy",
                    "-avoid_negative_ts", "make_zero",
                    str(out_mp4)
                ]
            else:
                stream_url = info.get("url")
                cmd = [
                    "ffmpeg", "-y",
                    "-headers", headers_str,
                    "-ss", str(start_f), "-to", str(end_f), "-i", stream_url,
                    "-c", "copy",
                    "-avoid_negative_ts", "make_zero",
                    str(out_mp4)
                ]

            subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)



            if not out_mp4.exists() or out_mp4.stat().st_size == 0:
                raise FileNotFoundError("FFmpeg did not produce a valid MP4 clip")

            clip_bytes = out_mp4.read_bytes()
            shutil.rmtree(clip_dir, ignore_errors=True)

            title_slug = (info.get("title") or "sermon-clip")[:50].replace(" ", "-").lower()
            filename = f"dabar-{title_slug}-{int(start_f)}s-{int(end_f)}s.mp4"

            response = HttpResponse(clip_bytes, content_type="video/mp4")
            response["Content-Disposition"] = f'attachment; filename="{filename}"'
            response["Content-Length"] = str(len(clip_bytes))
            return response

        except Exception as exc:
            logger.exception("Clip download failed: %s", str(exc))
            shutil.rmtree(clip_dir, ignore_errors=True)
            return Response(
                {"detail": f"Clip download failed: {str(exc)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
