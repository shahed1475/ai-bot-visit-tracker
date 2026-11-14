# Django middleware

Two variants, same detection (shared registry, declared purpose):

**1. `ai_bot_tracker_django` (no models, no migrations)**
```python
MIDDLEWARE = ["ai_bot_tracker_django.AiBotTrackerMiddleware", ...]
AI_BOT_TRACKER = {"database": {"type": "sqlite", "path": "bot_visits.sqlite"}}   # or "DATABASE_URL": "sqlite:///bot_visits.sqlite"
# optional: "report": {"endpoint": "https://your-worker.workers.dev", "key": "...", "site": "example.com"}
```

**2. `ai_bot_tracker` app (Django ORM: `BotVisit`, admin-friendly)**
```python
INSTALLED_APPS += ["ai_bot_tracker"]
MIDDLEWARE += ["ai_bot_tracker.middleware.AiBotTrackerMiddleware"]
```
then `python manage.py migrate`. Needs `pip install user-agents`. It reads `signatures/ai-bots.json` when run from this repository layout; otherwise it falls back to its built-in list.

`pip install django`. Copy `middleware/python/django`, `core` and `signatures` together. `request.bot_info` (variant 1) holds the `BotInfo`. Never stored: cookies, authorization headers, query strings.

Tests: `python3 -I tests/test_python_core.py`.
