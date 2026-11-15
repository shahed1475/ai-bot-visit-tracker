"""Django app (single file) with the Django middleware (report-only). Env: PORT, TRACKER_URL, TRACKER_KEY, SITE."""
import os
import sys
from wsgiref.simple_server import WSGIRequestHandler, make_server

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../..")
sys.path.insert(0, os.path.join(ROOT, "middleware/python/django"))

from django.conf import settings  # noqa: E402

settings.configure(
    DEBUG=False, SECRET_KEY="e2e", ALLOWED_HOSTS=["*"], ROOT_URLCONF=__name__,
    MIDDLEWARE=["ai_bot_tracker_django.AiBotTrackerMiddleware"],
    AI_BOT_TRACKER={"database": False, "report": {"endpoint": os.environ["TRACKER_URL"], "key": os.environ["TRACKER_KEY"], "site": os.environ["SITE"]}},
)
import django  # noqa: E402

django.setup()
from django.core.wsgi import get_wsgi_application  # noqa: E402
from django.http import HttpResponse  # noqa: E402
from django.urls import re_path  # noqa: E402


def page(request, p):
    return HttpResponse("not found", status=404) if p.endswith("missing") else HttpResponse(f"ok /{p}")


urlpatterns = [re_path(r"^(?P<p>.*)$", page)]


class Quiet(WSGIRequestHandler):
    def log_message(self, *args):
        pass


make_server("127.0.0.1", int(os.environ["PORT"]), get_wsgi_application(), handler_class=Quiet).serve_forever()
