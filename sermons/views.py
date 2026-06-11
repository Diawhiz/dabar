from rest_framework import generics

from .models import Sermon
from .serializers import SermonSerializer


class SermonListCreateView(generics.ListCreateAPIView):
    queryset = Sermon.objects.all().order_by("-created_at")
    serializer_class = SermonSerializer


class SermonDetailView(generics.RetrieveAPIView):
    queryset = Sermon.objects.all()
    serializer_class = SermonSerializer
