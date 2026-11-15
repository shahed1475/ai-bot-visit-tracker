"""Flask extension: records AI bot visits.

    app = Flask(__name__)
    AiBotTrackerFlask(app, {"database": {"type": "sqlite", "path": "bot_visits.sqlite"}})
    # optional: also send visits to your Cloudflare dashboard
    AiBotTrackerFlask(app, {"report": {"endpoint": "https://...workers.dev", "key": "...", "site": "example.com"}})

Config keys: see core/tracker_python.py (BotTracker). Extra: add_headers (False), header_prefix ("X-Bot-Tracker-").
"""
import os
import sys
import time

from flask import g, request

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../.."))
from core.tracker_python import BotTracker  # noqa: E402


class AiBotTrackerFlask:
    def __init__(self, app=None, config=None, **kwargs):
        self.config = {**(config or {}), **kwargs}
        self.tracker = None
        if app is not None:
            self.init_app(app)

    def init_app(self, app):
        self.tracker = BotTracker(self.config)
        app.extensions["ai_bot_tracker"] = self
        app.before_request(self._before)
        app.after_request(self._after)

    def _before(self):
        g._abt_start = time.monotonic()
        headers = {k.lower(): v for k, v in request.headers.items()}
        ip = self.tracker.client_ip(headers, request.remote_addr)
        g._abt_ip = ip
        g.bot_info = self.tracker.inspect(request.headers.get("User-Agent"), ip)

    def _after(self, response):
        info = getattr(g, "bot_info", None)
        if info is None:
            return response
        try:
            if self.config.get("add_headers"):
                prefix = self.config.get("header_prefix", "X-Bot-Tracker-")
                response.headers[f"{prefix}Bot-Name"] = info.name
            self.tracker.record(
                info, ip=g._abt_ip, user_agent=request.headers.get("User-Agent", ""), url=request.base_url, method=request.method,
                status=response.status_code, referer=request.headers.get("Referer", ""), headers=dict(request.headers),
                elapsed_ms=int((time.monotonic() - g._abt_start) * 1000))
        except Exception:
            pass  # never break the response
        return response

    def get_recent_visits(self, limit=50):
        return self.tracker.db.get_recent_visits(limit) if self.tracker.db else []

    def get_stats(self):
        return self.tracker.db.get_bot_stats() if self.tracker.db else []


def create_bot_tracker(app=None, **config):
    return AiBotTrackerFlask(app, config)
