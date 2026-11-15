# Flask extension

```python
from ai_bot_tracker_flask import AiBotTrackerFlask

app = Flask(__name__)
AiBotTrackerFlask(app, {
    "database": {"type": "sqlite", "path": "bot_visits.sqlite"},     # False = no local storage
    # "report": {"endpoint": "https://your-worker.workers.dev", "key": "...", "site": "example.com"},
})
```

`pip install flask`. Copy `middleware/python/flask`, `core` and `signatures` together. In a view, `g.bot_info` is `None` for humans or a `BotInfo` (`name`, `bot_id`, `kind`, `purpose`, `verified`).

Config: `async_logging` (True: store in a background thread), `add_headers`, `ip_ranges` (`{bot_id: [cidr]}`), `custom_bots`, `trust_cloudflare_headers` (False). Details in `core/tracker_python.py`. Stored: classification is the declared purpose; cookies/authorization headers and query strings are never stored.

Tests: `python3 -I tests/test_python_core.py` (needs flask and django).
