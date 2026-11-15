# Add to your Django settings.py (variant 1: no models, no migrations).
MIDDLEWARE = [
    "ai_bot_tracker_django.AiBotTrackerMiddleware",
    # ... your other middleware
]

AI_BOT_TRACKER = {
    "database": {"type": "sqlite", "path": "bot_visits.sqlite"},
    # Optional: also send every bot visit to your Cloudflare dashboard.
    # "report": {"endpoint": "https://your-worker.workers.dev", "key": "INGEST_KEY", "site": "example.com"},
}
