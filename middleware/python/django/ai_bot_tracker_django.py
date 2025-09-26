import os
import sys
import json
import time
from datetime import datetime
from django.utils.deprecation import MiddlewareMixin
from django.conf import settings
from django.http import HttpResponse

# Add the core modules to the path
sys.path.append(os.path.join(os.path.dirname(__file__), '../../../'))

try:
    from core.bot_detector_python import BotDetector
    from core.classifier_python import Classifier
    from core.database_python import Database
except ImportError:
    # Fallback: create simplified versions if core Python modules don't exist
    print("Warning: Core Python modules not found. Using simplified implementations.")
    
    class BotDetector:
        def __init__(self):
            self.bot_patterns = {
                'googlebot': ['googlebot', 'google'],
                'bingbot': ['bingbot', 'bing'],
                'gptbot': ['gptbot', 'chatgpt-user'],
                'claudebot': ['claudebot', 'claude-web'],
                'perplexitybot': ['perplexitybot', 'perplexity'],
                'facebookbot': ['facebookexternalhit'],
                'twitterbot': ['twitterbot'],
                'linkedinbot': ['linkedinbot'],
                'slackbot': ['slackbot'],
                'discordbot': ['discordbot']
            }
        
        def detect_bot(self, user_agent, ip_address=None):
            if not user_agent:
                return None
            
            user_agent_lower = user_agent.lower()
            for bot_name, patterns in self.bot_patterns.items():
                for pattern in patterns:
                    if pattern in user_agent_lower:
                        return {
                            'name': bot_name,
                            'type': 'indexing' if 'bot' in pattern else 'retrieval',
                            'confidence': 0.9
                        }
            return None
    
    class Classifier:
        def __init__(self, rules=None):
            self.rules = rules or {}
        
        def classify_request(self, request_data):
            url = request_data.get('url', '')
            method = request_data.get('method', 'GET')
            
            # Simple classification logic
            if '/search' in url or '/api/' in url:
                classification = 'retrieval'
            elif method == 'GET' and any(ext in url for ext in ['.html', '.php', '/']):
                classification = 'indexing'
            else:
                classification = 'unknown'
            
            return {
                'classification': classification,
                'confidence': 0.7,
                'reasons': [f'URL pattern: {url}', f'Method: {method}']
            }
    
    class Database:
        def __init__(self, config):
            self.config = config
            self.connection = None
        
        async def connect(self):
            # Simplified database connection
            print(f"Connected to database: {self.config}")
        
        async def log_visit(self, visit_data):
            # Simplified logging
            print(f"Logged visit: {visit_data.get('bot_name')} -> {visit_data.get('page_url')}")
        
        async def get_stats(self):
            return []
        
        async def get_recent_visits(self, limit=50):
            return []
        
        async def close(self):
            pass


class AiBotTrackerMiddleware(MiddlewareMixin):
    """
    Django middleware for AI bot visit tracking
    
    This middleware intercepts incoming requests, detects AI bots,
    classifies their behavior, and logs visit data to the database.
    
    Add to MIDDLEWARE in settings.py:
    MIDDLEWARE = [
        ...
        'path.to.ai_bot_tracker_django.AiBotTrackerMiddleware',
        ...
    ]
    
    Configuration in settings.py:
    BOT_TRACKER = {
        'database_type': 'sqlite',
        'database_path': '/path/to/bot_visits.db',
        'enable_logging': True,
        'custom_bots': [],
        'classification_rules': {},
        'add_headers': True,
        'header_prefix': 'X-Bot-Tracker-'
    }
    """
    
    def __init__(self, get_response=None):
        super().__init__(get_response)
        self.get_response = get_response
        
        # Default configuration
        self.config = {
            # Database configuration
            'database_type': 'sqlite',
            'database_path': os.path.join(os.path.dirname(__file__), '../../../data/bot_visits.db'),
            'database_host': 'localhost',
            'database_port': 5432,
            'database_name': 'bot_tracker',
            'database_user': 'postgres',
            'database_password': '',
            
            # Logging configuration
            'enable_logging': True,
            'log_level': 'info',
            
            # Bot detection configuration
            'custom_bots': [],
            
            # Classification configuration
            'classification_rules': {},
            
            # Performance configuration
            'enable_async': True,
            
            # Response configuration
            'add_headers': True,
            'header_prefix': 'X-Bot-Tracker-',
            
            # URL filtering
            'exclude_urls': ['/admin/', '/static/', '/media/'],
            'include_only_urls': None  # If set, only these URLs will be tracked
        }
        
        # Update config from Django settings
        if hasattr(settings, 'BOT_TRACKER'):
            self.config.update(settings.BOT_TRACKER)
        
        self.database = None
        self.bot_detector = None
        self.classifier = None
        self.initialized = False
        
        self._initialize_components()
    
    def _initialize_components(self):
        """Initialize bot detector, classifier, and database"""
        try:
            # Initialize database
            db_config = {
                'type': self.config['database_type'],
                'path': self.config['database_path'],
                'host': self.config['database_host'],
                'port': self.config['database_port'],
                'name': self.config['database_name'],
                'user': self.config['database_user'],
                'password': self.config['database_password']
            }
            self.database = Database(db_config)
            
            # Initialize bot detector
            self.bot_detector = BotDetector()
            if self.config['custom_bots']:
                for bot in self.config['custom_bots']:
                    self.bot_detector.add_custom_bot(bot)
            
            # Initialize classifier
            self.classifier = Classifier(self.config['classification_rules'])
            
            self.initialized = True
            
            if self.config['enable_logging']:
                print('[AI Bot Tracker Django] Middleware initialized successfully')
                
        except Exception as error:
            print(f'[AI Bot Tracker Django] Initialization failed: {error}')
            # Don't raise error to prevent Django from failing to start
    
    def __call__(self, request):
        """Process request through the middleware"""
        # Record start time
        start_time = time.time()
        
        # Check if URL should be tracked
        if not self._should_track_url(request.path):
            return self.get_response(request)
        
        # Extract request data
        request_data = self._extract_request_data(request)
        
        # Get response
        response = self.get_response(request)
        
        # Process bot detection and logging
        if self.initialized:
            self._process_request(request, request_data, response, start_time)
        
        return response
    
    def _should_track_url(self, url):
        """Check if URL should be tracked based on configuration"""
        # Check exclude patterns
        for exclude_pattern in self.config['exclude_urls']:
            if exclude_pattern in url:
                return False
        
        # Check include patterns (if specified)
        if self.config['include_only_urls']:
            for include_pattern in self.config['include_only_urls']:
                if include_pattern in url:
                    return True
            return False
        
        return True
    
    def _extract_request_data(self, request):
        """Extract relevant data from the Django request"""
        return {
            'ip_address': self._get_client_ip(request),
            'user_agent': request.META.get('HTTP_USER_AGENT', ''),
            'page_url': request.build_absolute_uri(),
            'referer': request.META.get('HTTP_REFERER', ''),
            'request_method': request.method,
            'headers': self._get_request_headers(request),
            'timestamp': datetime.now()
        }
    
    def _get_client_ip(self, request):
        """Get the real client IP address"""
        # Check for forwarded IP first
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        
        x_real_ip = request.META.get('HTTP_X_REAL_IP')
        if x_real_ip:
            return x_real_ip
        
        return request.META.get('REMOTE_ADDR', '127.0.0.1')
    
    def _get_request_headers(self, request):
        """Extract HTTP headers from Django request"""
        headers = {}
        for key, value in request.META.items():
            if key.startswith('HTTP_'):
                # Convert HTTP_USER_AGENT to User-Agent
                header_name = key[5:].replace('_', '-').title()
                headers[header_name] = value
        return headers
    
    def _process_request(self, request, request_data, response, start_time):
        """Process bot detection and logging"""
        try:
            # Detect if this is a bot
            bot_info = self.bot_detector.detect_bot(
                request_data.get('user_agent', ''),
                request_data.get('ip_address', '')
            )
            
            if bot_info:
                # Add tracking headers if enabled
                if self.config['add_headers']:
                    response[f"{self.config['header_prefix']}Detected"] = 'true'
                    response[f"{self.config['header_prefix']}Bot-Name"] = bot_info['name']
                    response[f"{self.config['header_prefix']}Bot-Type"] = bot_info['type']
                
                # Process bot visit
                self._process_bot_visit(request_data, bot_info, response, start_time)
            
        except Exception as error:
            if self.config['enable_logging']:
                print(f'[AI Bot Tracker Django] Error processing request: {error}')
    
    def _process_bot_visit(self, request_data, bot_info, response, start_time):
        """Process bot visit and log to database"""
        try:
            # Classify the request
            classification = self.classifier.classify_request({
                'url': request_data['page_url'],
                'headers': request_data['headers'],
                'user_agent': request_data['user_agent'],
                'referer': request_data['referer'],
                'ip_address': request_data['ip_address'],
                'method': request_data['request_method'],
                'timestamp': request_data['timestamp']
            })
            
            # Calculate processing time
            processing_time = (time.time() - start_time) * 1000  # Convert to milliseconds
            
            # Prepare visit data
            visit_data = {
                'ip_address': request_data['ip_address'],
                'bot_name': bot_info['name'],
                'page_url': request_data['page_url'],
                'headers': json.dumps(request_data['headers']),
                'classification': classification['classification'],
                'response_status': response.status_code,
                'processing_time': processing_time,
                'timestamp': request_data['timestamp'],
                'user_agent': request_data['user_agent'],
                'referer': request_data['referer'],
                'request_method': request_data['request_method'],
                'bot_type': bot_info['type'],
                'confidence': classification.get('confidence', 0),
                'reasons': json.dumps(classification.get('reasons', []))
            }
            
            # Log to database (async if enabled)
            if self.config['enable_async']:
                # In a real implementation, you'd use Django Channels or Celery
                # For now, we'll log synchronously
                self._log_visit_sync(visit_data)
            else:
                self._log_visit_sync(visit_data)
            
            if self.config['enable_logging'] and self.config['log_level'] == 'debug':
                print(f'[AI Bot Tracker Django] Bot visit logged: {bot_info["name"]} -> {request_data["page_url"]}')
                
        except Exception as error:
            print(f'[AI Bot Tracker Django] Error processing bot visit: {error}')
    
    def _log_visit_sync(self, visit_data):
        """Log visit data synchronously"""
        try:
            # In a real async implementation, this would be handled differently
            # For now, we'll use a simplified approach
            if hasattr(self.database, 'log_visit'):
                # Simulate async call
                import asyncio
                try:
                    loop = asyncio.get_event_loop()
                    loop.run_until_complete(self.database.log_visit(visit_data))
                except RuntimeError:
                    # Create new event loop if none exists
                    asyncio.run(self.database.log_visit(visit_data))
        except Exception as error:
            print(f'[AI Bot Tracker Django] Database logging error: {error}')


class AiBotTrackerView:
    """
    Utility class for Django views to interact with bot tracker
    """
    
    def __init__(self):
        # Initialize with same config as middleware
        self.config = getattr(settings, 'BOT_TRACKER', {})
        self.database = None
        self._initialize_database()
    
    def _initialize_database(self):
        """Initialize database connection"""
        try:
            db_config = {
                'type': self.config.get('database_type', 'sqlite'),
                'path': self.config.get('database_path', 'bot_visits.db'),
                'host': self.config.get('database_host', 'localhost'),
                'port': self.config.get('database_port', 5432),
                'name': self.config.get('database_name', 'bot_tracker'),
                'user': self.config.get('database_user', 'postgres'),
                'password': self.config.get('database_password', '')
            }
            self.database = Database(db_config)
        except Exception as error:
            print(f'Error initializing database: {error}')
    
    def get_stats(self):
        """Get visit statistics"""
        if not self.database:
            return []
        
        try:
            import asyncio
            try:
                loop = asyncio.get_event_loop()
                return loop.run_until_complete(self.database.get_stats())
            except RuntimeError:
                return asyncio.run(self.database.get_stats())
        except Exception as error:
            print(f'Error getting stats: {error}')
            return []
    
    def get_recent_visits(self, limit=50):
        """Get recent visits"""
        if not self.database:
            return []
        
        try:
            import asyncio
            try:
                loop = asyncio.get_event_loop()
                return loop.run_until_complete(self.database.get_recent_visits(limit))
            except RuntimeError:
                return asyncio.run(self.database.get_recent_visits(limit))
        except Exception as error:
            print(f'Error getting recent visits: {error}')
            return []


# Decorator for view-specific bot tracking
def track_bots(**options):
    """Decorator to enable bot tracking for specific Django views"""
    def decorator(view_func):
        def wrapped_view(request, *args, **kwargs):
            # This decorator can be used for view-specific tracking logic
            # For now, it just calls the original view
            return view_func(request, *args, **kwargs)
        return wrapped_view
    return decorator


# Django management command helper
class BotTrackerCommand:
    """
    Helper class for Django management commands
    """
    
    @staticmethod
    def get_stats():
        """Get bot visit statistics"""
        tracker = AiBotTrackerView()
        return tracker.get_stats()
    
    @staticmethod
    def get_recent_visits(limit=50):
        """Get recent bot visits"""
        tracker = AiBotTrackerView()
        return tracker.get_recent_visits(limit)