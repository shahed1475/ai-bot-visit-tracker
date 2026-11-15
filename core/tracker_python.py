"""Framework-agnostic recorder shared by the Flask and Django middleware."""
import threading
from datetime import datetime, timezone
from typing import Any, Dict, Optional

try:
    from core.bot_detector_python import BotDetector
    from core.database_python import DatabaseHandler
    from core.reporter_python import Reporter
except ImportError:  # imported with core/ itself on sys.path
    from bot_detector_python import BotDetector
    from database_python import DatabaseHandler
    from reporter_python import Reporter

SENSITIVE_HEADERS = {"authorization", "cookie", "set-cookie", "x-api-key", "x-auth-token", "proxy-authorization"}
PURPOSES = ("training", "indexing", "retrieval")


class BotTracker:
    """config: database ({'type','path'} | False), report ({'endpoint','key','site'}), async_logging (True),
    custom_bots, ip_ranges ({bot_id: [cidr]}), skip_non_bots (True), trust_cloudflare_headers (False)."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        cfg = config or {}
        self.skip_non_bots = cfg.get("skip_non_bots", True)
        self.async_logging = cfg.get("async_logging", True)
        self.trust_cloudflare_headers = cfg.get("trust_cloudflare_headers", False)
        self.detector = BotDetector(custom_bots=cfg.get("custom_bots"))
        if cfg.get("ip_ranges"):
            self.detector.ip_ranges = cfg["ip_ranges"]
        db_cfg = cfg.get("database", {"type": "sqlite", "path": "data/bot_visits.sqlite"})
        self.db = DatabaseHandler(db_cfg) if db_cfg is not False else None
        self.reporter = Reporter(**cfg["report"]) if cfg.get("report") else None
        self._db_lock = threading.Lock()

    def client_ip(self, headers: Dict[str, str], remote_addr: Optional[str]) -> str:
        if self.trust_cloudflare_headers and headers.get("cf-connecting-ip"):
            return headers["cf-connecting-ip"]
        return remote_addr or ""

    def inspect(self, user_agent: Optional[str], ip: Optional[str]):
        return self.detector.detect_bot(user_agent or "", ip)

    def record(self, info, *, ip: str, user_agent: str, url: str, method: str, status: int,
               referer: str, headers: Dict[str, str], elapsed_ms: int) -> None:
        """Store (and optionally report) one bot visit. Runs in a thread unless async_logging is False."""
        clean_headers = {k: v for k, v in headers.items() if k.lower() not in SENSITIVE_HEADERS}
        clean_url = url.split("?", 1)[0].split("#", 1)[0]
        visit = {
            "timestamp": datetime.now(timezone.utc).isoformat(), "ip_address": ip, "bot_name": info.name, "page_url": clean_url,
            "headers": clean_headers, "classification": info.purpose if info.purpose in PURPOSES else "unknown",
            "user_agent": user_agent, "referer": referer, "request_method": method, "response_status": status, "processing_time_ms": elapsed_ms,
        }
        job = lambda: self._store(visit, info, ip, user_agent, clean_url, method, status, referer)  # noqa: E731
        if self.async_logging:
            threading.Thread(target=job, daemon=True).start()
        else:
            job()

    def _store(self, visit, info, ip, user_agent, url, method, status, referer) -> None:
        try:
            if self.db:
                with self._db_lock:
                    self.db.log_visit(visit)
            if self.reporter:
                path = "/" + url.split("://", 1)[-1].split("/", 1)[-1] if "://" in url else url
                clean_referer = (referer or "").split("?", 1)[0].split("#", 1)[0]  # query strings never leave the server
                self.reporter.add({"ip": ip, "ua": user_agent, "path": path, "method": method, "status": status, **({"referer": clean_referer} if clean_referer else {})})
        except Exception:
            pass  # tracking must never break a request
