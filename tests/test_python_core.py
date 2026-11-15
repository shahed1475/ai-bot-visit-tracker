"""Python core tests: shared fixtures, CIDR, dict-style BotInfo, Flask + Django middleware integration.
Run: python tests/test_python_core.py   (needs flask, django)"""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "middleware" / "python" / "flask"))
from core.bot_detector_python import BotDetector  # noqa: E402
from core import signatures  # noqa: E402

FIX = json.loads((ROOT / "signatures" / "fixtures.json").read_text())["cases"]
GPT = "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot"
CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"


class DetectorTest(unittest.TestCase):
    def test_shared_fixtures(self):
        d = BotDetector()
        for c in FIX:
            info = d.detect_bot(c["ua"], "203.0.113.9")
            if c["expect"] is None:
                self.assertIsNone(info, c["ua"])
                continue
            self.assertIsNotNone(info, c["ua"])
            self.assertEqual(info.bot_id, c["expect"]["id"], c["ua"])
            self.assertEqual(info.kind, c["expect"]["kind"])
            self.assertEqual(info.purpose, c["expect"]["purpose"])

    def test_dict_style_access_used_by_middleware(self):
        info = BotDetector().detect_bot(GPT, "1.2.3.4")
        self.assertEqual(info["name"], "GPTBot")
        self.assertEqual(info["type"], "training")
        self.assertEqual(info.get("missing", "x"), "x")

    def test_humans_none_and_generic_fallback(self):
        d = BotDetector()
        self.assertIsNone(d.detect_bot(CHROME))
        self.assertIsNone(d.detect_bot(""))
        self.assertIsNone(d.detect_bot(None))
        g = d.detect_bot("Mozilla/5.0 (compatible; FooBarBot/1.0)")
        self.assertEqual((g.bot_id, g.kind), ("generic-bot", "other"))

    def test_ip_verification(self):
        d = BotDetector()
        d.ip_ranges = {"gptbot": ["20.15.240.64/26"]}
        self.assertEqual(d.detect_bot(GPT, "20.15.240.70").verified, "verified")
        self.assertEqual(d.detect_bot(GPT, "8.8.8.8").verified, "unverified")
        self.assertEqual(d.detect_bot("compatible; ClaudeBot/1.0", "8.8.8.8").verified, "unknown")

    def test_cidr(self):
        r = ["20.15.240.64/26"]
        self.assertTrue(signatures.in_ranges("20.15.240.127", r))
        self.assertFalse(signatures.in_ranges("20.15.240.128", r))
        self.assertTrue(signatures.in_ranges("::ffff:20.15.240.70", r))
        self.assertTrue(signatures.in_ranges("2001:4860:4801:10::5", ["2001:4860:4801:10::/64"]))
        for bad in ["", "nope", "999.1.1.1", None]:
            self.assertFalse(signatures.in_ranges(bad, ["1.2.3.0/24"]))


class ReporterPayloadTest(unittest.TestCase):
    def test_reported_events_carry_no_query_string_cookie_or_header(self):
        from core.tracker_python import BotTracker

        t = BotTracker({"database": False, "async_logging": False})
        sent = []
        t.reporter = type("Capture", (), {"add": lambda self, event: sent.append(event)})()
        info = t.inspect(GPT, "203.0.113.9")
        t.record(info, ip="203.0.113.9", user_agent=GPT, url="https://example.com/pricing?token=abc#top", method="GET", status=200,
                 referer="https://news.example/p?id=7&sid=secret#frag", headers={"cookie": "s=1", "authorization": "Bearer x"}, elapsed_ms=3)
        self.assertEqual(sent, [{"ip": "203.0.113.9", "ua": GPT, "path": "/pricing", "method": "GET", "status": 200, "referer": "https://news.example/p"}])


class FlaskTest(unittest.TestCase):
    def test_flask_logs_bot_not_human(self):
        from flask import Flask
        import ai_bot_tracker_flask as m

        db = os.path.join(tempfile.mkdtemp(), "f.db")
        app = Flask(__name__)
        m.AiBotTrackerFlask(app, {"database": {"type": "sqlite", "path": db}, "async_logging": False})

        @app.route("/blog/post")
        def post():
            return "ok"

        c = app.test_client()
        self.assertEqual(c.get("/blog/post", headers={"User-Agent": CHROME}).status_code, 200)
        r = c.get("/blog/post?token=abc", headers={"User-Agent": GPT})
        self.assertEqual(r.status_code, 200)
        import sqlite3

        rows = sqlite3.connect(db).execute("select bot_name, classification from visits").fetchall()
        self.assertEqual(len(rows), 1, rows)
        self.assertEqual(rows[0][0], "GPTBot")


class DjangoTest(unittest.TestCase):
    def test_django_logs_bot_not_human(self):
        import django
        from django.conf import settings

        db = os.path.join(tempfile.mkdtemp(), "d.db")
        if not settings.configured:
            settings.configure(DEBUG=True, SECRET_KEY="x", ALLOWED_HOSTS=["*"], AI_BOT_TRACKER={"database": {"type": "sqlite", "path": db}, "async_logging": False})
            django.setup()
        sys.path.insert(0, str(ROOT / "middleware" / "python" / "django"))
        from django.http import HttpResponse
        from django.test import RequestFactory
        import ai_bot_tracker_django as m

        mw = m.AiBotTrackerMiddleware(lambda request: HttpResponse("ok", status=404))
        rf = RequestFactory()
        mw(rf.get("/blog/post", HTTP_USER_AGENT=CHROME))
        resp = mw(rf.get("/blog/post?token=abc", HTTP_USER_AGENT="Mozilla/5.0; compatible; Claude-User/1.0", HTTP_COOKIE="s=1"))
        self.assertEqual(resp.status_code, 404)
        import sqlite3

        rows = sqlite3.connect(db).execute("select bot_name, classification, response_status, page_url, headers from visits").fetchall()
        self.assertEqual(len(rows), 1, rows)
        self.assertEqual(rows[0][:3], ("Claude-User", "retrieval", 404))
        self.assertNotIn("token=abc", rows[0][3])
        self.assertNotIn("cookie", rows[0][4].lower())


if __name__ == "__main__":
    unittest.main()
