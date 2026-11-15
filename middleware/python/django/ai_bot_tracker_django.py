"""Django middleware: records AI bot visits (no Django models or migrations needed).

settings.py:
    MIDDLEWARE = ["ai_bot_tracker_django.AiBotTrackerMiddleware", ...]
    AI_BOT_TRACKER = {
        "database": {"type": "sqlite", "path": "bot_visits.sqlite"},      # or "DATABASE_URL": "sqlite:///bot_visits.sqlite"
        # optional: also send visits to your Cloudflare dashboard
        # "report": {"endpoint": "https://...workers.dev", "key": "...", "site": "example.com"},
    }
Config keys: see core/tracker_python.py (BotTracker).
"""
import os
import sys
import time
from urllib.parse import urlparse

from django.conf import settings

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../.."))
from core.tracker_python import BotTracker  # noqa: E402


def _database_from_url(url):
    u = urlparse(url)
    if u.scheme == "sqlite":
        return {"type": "sqlite", "path": u.path[1:]}  # sqlite:///rel.db -> rel.db, sqlite:////abs.db -> /abs.db
    if u.scheme in ("postgres", "postgresql"):
        return {"type": "postgresql", "host": u.hostname, "port": u.port or 5432, "database": u.path.lstrip("/"),
                "username": u.username, "password": u.password}
    raise ValueError(f"Unsupported DATABASE_URL scheme: {u.scheme}")


class AiBotTrackerMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        raw = {k.lower(): v for k, v in getattr(settings, "AI_BOT_TRACKER", {}).items()}
        if "database_url" in raw and "database" not in raw:
            raw["database"] = _database_from_url(raw.pop("database_url"))
        self.config = raw
        self.tracker = BotTracker(raw)

    def __call__(self, request):
        started = time.monotonic()
        headers = {k[5:].replace("_", "-").lower(): v for k, v in request.META.items() if k.startswith("HTTP_")}
        ip = self.tracker.client_ip(headers, request.META.get("REMOTE_ADDR"))
        ua = request.META.get("HTTP_USER_AGENT", "")
        info = self.tracker.inspect(ua, ip)
        request.bot_info = info
        response = self.get_response(request)
        if info is not None:
            try:
                if self.config.get("add_headers"):
                    response[f"{self.config.get('header_prefix', 'X-Bot-Tracker-')}Bot-Name"] = info.name
                self.tracker.record(
                    info, ip=ip, user_agent=ua, url=request.build_absolute_uri(request.path), method=request.method,
                    status=response.status_code, referer=request.META.get("HTTP_REFERER", ""), headers=headers,
                    elapsed_ms=int((time.monotonic() - started) * 1000))
            except Exception:
                pass  # never break the response
        return response
