"""
Fail-safe WSGI entry point wrapper for Render / Gunicorn.
Maps 'app' module imports to 'dabar.wsgi.application'.
"""
import os
import django
from django.core.management import call_command

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "dabar.settings")
django.setup()

try:
    call_command("migrate", interactive=False)
except Exception as e:
    print(f"Startup migration warning: {e}")

from dabar.wsgi import application as app
from dabar.wsgi import application

__all__ = ["app", "application"]

