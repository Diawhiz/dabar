"""
Fail-safe WSGI entry point wrapper for Render / Gunicorn.
Maps 'app' module imports to 'dabar.wsgi.application'.
"""
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "dabar.settings")
django.setup()

from dabar.wsgi import application as app
from dabar.wsgi import application

__all__ = ["app", "application"]
