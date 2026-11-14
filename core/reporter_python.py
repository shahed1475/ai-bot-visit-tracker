"""Fire-and-forget reporting to the Cloudflare tracker (POST {endpoint}/api/ingest). Never raises into your app."""
import json
import queue
import threading
import urllib.request
from typing import Dict, List


class Reporter:
    def __init__(self, endpoint: str, key: str, site: str, timeout: float = 2.0, flush_seconds: float = 2.0, max_batch: int = 50):
        if not (endpoint and key and site):
            raise ValueError("Reporter needs endpoint, key and site")
        self.url = endpoint.rstrip("/") + "/api/ingest"
        self.key, self.site, self.timeout = key, site, timeout
        self.flush_seconds, self.max_batch = flush_seconds, max_batch
        self._queue: "queue.Queue[Dict]" = queue.Queue(maxsize=1000)
        self._worker = None
        self._lock = threading.Lock()

    def send(self, events: List[Dict]) -> bool:
        """POST a batch. True when the tracker accepted it; False on any failure."""
        try:
            body = json.dumps({"events": [{"site": self.site, **e} for e in events]}).encode()
            req = urllib.request.Request(self.url, data=body, method="POST", headers={
                "Authorization": f"Bearer {self.key}", "Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=self.timeout) as res:  # noqa: S310 (operator-configured URL)
                return 200 <= res.status < 300
        except Exception:
            return False

    def add(self, event: Dict) -> None:
        """Queue an event; a daemon thread sends batches. Drops the event if the queue is full."""
        try:
            self._queue.put_nowait(event)
        except queue.Full:
            return
        with self._lock:
            if self._worker is None or not self._worker.is_alive():
                self._worker = threading.Thread(target=self._run, daemon=True)
                self._worker.start()

    def _run(self) -> None:
        while True:
            try:
                batch = [self._queue.get(timeout=self.flush_seconds)]
            except queue.Empty:
                return
            while len(batch) < self.max_batch:
                try:
                    batch.append(self._queue.get_nowait())
                except queue.Empty:
                    break
            self.send(batch)
