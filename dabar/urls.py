from django.contrib import admin
from django.urls import include, path
from django.http import JsonResponse

def root_health_check(request):
    return JsonResponse({"status": "ok", "app": "Dabar API", "version": "1.0.0"})

urlpatterns = [
    path("", root_health_check, name="root-health"),
    path("health/", root_health_check, name="health-check"),
    path("admin/", admin.site.urls),
    path("api/", include("sermons.urls")),
]

