"""
Django Middleware for AI Bot Visit Tracking
"""

import json
import time
import logging
import threading
from queue import Queue
from typing import Dict, Optional
from django.conf import settings
from django.utils.deprecation import MiddlewareMixin
from django.http import HttpRequest, HttpResponse
from django.utils import timezone
from .models import BotVisit
from .utils import BotDetector, RequestClassifier, get_client_ip, sanitize_headers

logger = logging.getLogger(__name__)


class AiBotTrackerMiddleware(MiddlewareMixin):
    """
    Django middleware for detecting and logging AI bot visits
    """
    
    def __init__(self, get_response=None):
        super().__init__(get_response)
        
        # Get configuration from Django settings
        config = getattr(settings, 'AI_BOT_TRACKER', {})
        
        # Initialize components
        self.bot_detector = BotDetector(
            custom_patterns=config.get('custom_bot_patterns', {}),
            ip_ranges=config.get('ip_ranges', [])
        )
        
        self.classifier = RequestClassifier(
            custom_rules=config.get('classification_rules', {})
        )
        
        # Configuration options
        self.enable_logging = config.get('enable_logging', True)
        self.skip_non_bots = config.get('skip_non_bots', True)
        self.async_logging = config.get('async_logging', True)
        self.log_all_requests = config.get('log_all_requests', False)
        
        # Async logging setup
        if self.async_logging:
            self.log_queue = Queue()
            self.log_thread = threading.Thread(target=self._async_logger, daemon=True)
            self.log_thread.start()
        
        # Request tracking
        self.request_start_times = {}
        
        if self.enable_logging:
            logger.info("AI Bot Tracker middleware initialized")
    
    def process_request(self, request: HttpRequest) -> Optional[HttpResponse]:
        """Process incoming request"""
        # Store start time for response time calculation
        request._ai_bot_tracker_start_time = time.time()
        
        # Extract request information
        user_agent = request.META.get('HTTP_USER_AGENT', '')
        ip_address = get_client_ip(request)
        
        # Detect bot
        bot_info = self.bot_detector.get_bot_info(user_agent, ip_address)
        
        # Skip processing if not a bot and skip_non_bots is enabled
        if self.skip_non_bots and not bot_info['is_bot'] and not self.log_all_requests:
            return None
        
        # Store bot info in request for later use
        request._ai_bot_info = bot_info
        
        # Extract headers
        headers = {}
        for key, value in request.META.items():
            if key.startswith('HTTP_'):
                header_name = key[5:].replace('_', '-').lower()
                headers[header_name] = value
        
        # Add non-HTTP headers that might be useful
        for key in ['CONTENT_TYPE', 'CONTENT_LENGTH', 'REQUEST_METHOD']:
            if key in request.META:
                headers[key.lower().replace('_', '-')] = request.META[key]
        
        # Sanitize headers
        sanitized_headers = sanitize_headers(headers)
        request._ai_bot_headers = sanitized_headers
        
        # Classify request
        classification_info = self.classifier.classify_request(
            url=request.get_full_path(),
            headers=sanitized_headers,
            user_agent=user_agent,
            ip_address=ip_address,
            method=request.method
        )
        
        request._ai_bot_classification = classification_info
        
        if self.enable_logging and bot_info['is_bot']:
            logger.info(
                f"Bot detected: {bot_info['bot_name']} from {ip_address} "
                f"accessing {request.get_full_path()} "
                f"(classified as {classification_info['classification']})"
            )
        
        return None
    
    def process_response(self, request: HttpRequest, response: HttpResponse) -> HttpResponse:
        """Process response and log the visit"""
        # Check if we have bot info (might not exist if skipped in process_request)
        if not hasattr(request, '_ai_bot_info'):
            return response
        
        # Calculate response time
        start_time = getattr(request, '_ai_bot_tracker_start_time', time.time())
        response_time = int((time.time() - start_time) * 1000)  # Convert to milliseconds
        
        # Prepare visit data
        visit_data = {
            'timestamp': timezone.now(),
            'ip_address': get_client_ip(request),
            'bot_name': request._ai_bot_info.get('bot_name'),
            'page_url': request.build_absolute_uri(),
            'headers': json.dumps(request._ai_bot_headers, default=str),
            'classification': request._ai_bot_classification['classification'],
            'classification_confidence': request._ai_bot_classification['confidence'],
            'classification_reason': '; '.join(request._ai_bot_classification['reasons']),
            'user_agent': request.META.get('HTTP_USER_AGENT', ''),
            'referer': request.META.get('HTTP_REFERER'),
            'request_method': request.method,
            'response_status': response.status_code,
            'response_time': response_time
        }
        
        # Log the visit
        if self.async_logging:
            self.log_queue.put(visit_data)
        else:
            self._save_visit(visit_data)
        
        return response
    
    def _save_visit(self, visit_data: Dict):
        """Save visit to database"""
        try:
            BotVisit.objects.create(**visit_data)
        except Exception as e:
            if self.enable_logging:
                logger.error(f"Failed to save bot visit: {e}")
    
    def _async_logger(self):
        """Async logger thread function"""
        while True:
            try:
                visit_data = self.log_queue.get()
                if visit_data is None:  # Shutdown signal
                    break
                self._save_visit(visit_data)
                self.log_queue.task_done()
            except Exception as e:
                if self.enable_logging:
                    logger.error(f"Error in async logger: {e}")
    
    def shutdown(self):
        """Shutdown the middleware gracefully"""
        if self.async_logging and hasattr(self, 'log_queue'):
            # Signal shutdown and wait for queue to empty
            self.log_queue.put(None)
            if hasattr(self, 'log_thread'):
                self.log_thread.join(timeout=5)
    
    @classmethod
    def get_stats(cls, time_range='24h', bot_name=None, classification=None):
        """Get statistics about bot visits"""
        return BotVisit.get_stats(time_range, bot_name, classification)
    
    @classmethod
    def export_to_csv(cls, file_path: str, time_range='24h', bot_name=None, classification=None):
        """Export bot visits to CSV file"""
        from .utils import export_to_csv
        from datetime import timedelta
        
        # Build queryset with filters
        queryset = BotVisit.objects.all()
        
        # Apply time filter
        now = timezone.now()
        if time_range == '1h':
            time_filter = now - timedelta(hours=1)
        elif time_range == '24h':
            time_filter = now - timedelta(hours=24)
        elif time_range == '7d':
            time_filter = now - timedelta(days=7)
        elif time_range == '30d':
            time_filter = now - timedelta(days=30)
        else:
            time_filter = now - timedelta(hours=24)
        
        queryset = queryset.filter(timestamp__gte=time_filter)
        
        # Apply additional filters
        if bot_name:
            queryset = queryset.filter(bot_name=bot_name)
        if classification:
            queryset = queryset.filter(classification=classification)
        
        # Export to CSV
        export_to_csv(queryset, file_path)
        
        return queryset.count()
    
    @classmethod
    def export_to_json(cls, file_path: str, time_range='24h', bot_name=None, classification=None):
        """Export bot visits to JSON file"""
        from .utils import export_to_json
        from datetime import timedelta
        
        # Build queryset with filters (same logic as CSV export)
        queryset = BotVisit.objects.all()
        
        # Apply time filter
        now = timezone.now()
        if time_range == '1h':
            time_filter = now - timedelta(hours=1)
        elif time_range == '24h':
            time_filter = now - timedelta(hours=24)
        elif time_range == '7d':
            time_filter = now - timedelta(days=7)
        elif time_range == '30d':
            time_filter = now - timedelta(days=30)
        else:
            time_filter = now - timedelta(hours=24)
        
        queryset = queryset.filter(timestamp__gte=time_filter)
        
        # Apply additional filters
        if bot_name:
            queryset = queryset.filter(bot_name=bot_name)
        if classification:
            queryset = queryset.filter(classification=classification)
        
        # Export to JSON
        export_to_json(queryset, file_path)
        
        return queryset.count()
    
    @classmethod
    def cleanup_old_visits(cls, days_to_keep=30):
        """Clean up old visit records"""
        from datetime import timedelta
        
        cutoff_date = timezone.now() - timedelta(days=days_to_keep)
        deleted_count, _ = BotVisit.objects.filter(timestamp__lt=cutoff_date).delete()
        
        if deleted_count > 0:
            logger.info(f"Cleaned up {deleted_count} old bot visit records")
        
        return deleted_count


# Convenience function for easy setup
def setup_ai_bot_tracker(app_config: Dict = None):
    """
    Setup AI Bot Tracker with custom configuration
    
    Usage in Django settings:
    
    AI_BOT_TRACKER = {
        'enable_logging': True,
        'skip_non_bots': True,
        'async_logging': True,
        'custom_bot_patterns': {
            'MyBot': [r'MyBot/\d+\.\d+']
        },
        'ip_ranges': ['192.168.1.0/24'],
        'classification_rules': {
            'indexing_patterns': [r'/my-sitemap'],
            'retrieval_patterns': [r'/my-api/'],
            'retrieval_headers': ['x-my-bot-id']
        }
    }
    """
    from django.conf import settings
    
    if app_config:
        # Update Django settings
        if not hasattr(settings, 'AI_BOT_TRACKER'):
            settings.AI_BOT_TRACKER = {}
        settings.AI_BOT_TRACKER.update(app_config)
    
    return AiBotTrackerMiddleware