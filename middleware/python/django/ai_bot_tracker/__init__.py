"""
AI Bot Tracker - Django Middleware
A comprehensive middleware solution for detecting, logging, and analyzing AI bot visits.
"""

from .middleware import AiBotTrackerMiddleware
from .models import BotVisit
from .utils import BotDetector, RequestClassifier

__version__ = '1.0.0'
__all__ = ['AiBotTrackerMiddleware', 'BotVisit', 'BotDetector', 'RequestClassifier']