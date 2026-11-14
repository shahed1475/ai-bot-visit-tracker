"""AI Bot Tracker: Django middleware (ORM variant) for detecting and logging AI bot visits.

Names are imported lazily: importing models here would break INSTALLED_APPS ("Apps aren't loaded yet").
"""

__version__ = '2.0.0'
__all__ = ['AiBotTrackerMiddleware', 'BotVisit', 'BotDetector', 'RequestClassifier']

_LAZY = {
    'AiBotTrackerMiddleware': '.middleware',
    'BotVisit': '.models',
    'BotDetector': '.utils',
    'RequestClassifier': '.utils',
}


def __getattr__(name):
    if name in _LAZY:
        from importlib import import_module
        return getattr(import_module(_LAZY[name], __name__), name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
