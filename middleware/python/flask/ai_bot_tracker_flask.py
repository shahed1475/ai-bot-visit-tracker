import os
import sys
import json
import time
from datetime import datetime
from flask import Flask, request, g
from functools import wraps

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


class AiBotTrackerFlask:
    """
    Flask extension for AI bot visit tracking
    
    This extension intercepts incoming requests, detects AI bots,
    classifies their behavior, and logs visit data to the database.
    """
    
    def __init__(self, app=None, **kwargs):
        self.app = app
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
            'header_prefix': 'X-Bot-Tracker-'
        }
        
        # Update config with provided kwargs
        self.config.update(kwargs)
        
        self.database = None
        self.bot_detector = None
        self.classifier = None
        self.initialized = False
        
        if app is not None:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize the Flask application with bot tracking"""
        self.app = app
        
        # Update config from Flask app config
        for key, value in app.config.items():
            if key.startswith('BOT_TRACKER_'):
                config_key = key.replace('BOT_TRACKER_', '').lower()
                self.config[config_key] = value
        
        # Register before_request and after_request handlers
        app.before_request(self._before_request)
        app.after_request(self._after_request)
        
        # Initialize components
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
                print('[AI Bot Tracker Flask] Extension initialized successfully')
                
        except Exception as error:
            print(f'[AI Bot Tracker Flask] Initialization failed: {error}')
            raise error
    
    def _before_request(self):
        """Handle request start - record timing and extract data"""
        g.bot_tracker_start_time = time.time()
        g.bot_tracker_request_data = self._extract_request_data()
    
    def _after_request(self, response):
        """Handle request end - process bot detection and logging"""
        if not self.initialized:
            return response
        
        try:
            request_data = getattr(g, 'bot_tracker_request_data', {})
            start_time = getattr(g, 'bot_tracker_start_time', time.time())
            
            # Detect if this is a bot
            bot_info = self.bot_detector.detect_bot(
                request_data.get('user_agent', ''),
                request_data.get('ip_address', '')
            )
            
            if bot_info:
                # Add tracking headers if enabled
                if self.config['add_headers']:
                    response.headers[f"{self.config['header_prefix']}Detected"] = 'true'
                    response.headers[f"{self.config['header_prefix']}Bot-Name"] = bot_info['name']
                    response.headers[f"{self.config['header_prefix']}Bot-Type"] = bot_info['type']
                
                # Process bot visit
                self._process_bot_visit(request_data, bot_info, response, start_time)
            
        except Exception as error:
            if self.config['enable_logging']:
                print(f'[AI Bot Tracker Flask] Error in after_request: {error}')
        
        return response
    
    def _extract_request_data(self):
        """Extract relevant data from the Flask request"""
        return {
            'ip_address': self._get_client_ip(),
            'user_agent': request.headers.get('User-Agent', ''),
            'page_url': request.url,
            'referer': request.headers.get('Referer', ''),
            'request_method': request.method,
            'headers': dict(request.headers),
            'timestamp': datetime.now()
        }
    
    def _get_client_ip(self):
        """Get the real client IP address"""
        # Check for forwarded IP first
        if request.headers.get('X-Forwarded-For'):
            return request.headers.get('X-Forwarded-For').split(',')[0].strip()
        elif request.headers.get('X-Real-IP'):
            return request.headers.get('X-Real-IP')
        else:
            return request.remote_addr or '127.0.0.1'
    
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
                # In a real implementation, you'd use a task queue like Celery
                # For now, we'll log synchronously
                self._log_visit_sync(visit_data)
            else:
                self._log_visit_sync(visit_data)
            
            if self.config['enable_logging'] and self.config['log_level'] == 'debug':
                print(f'[AI Bot Tracker Flask] Bot visit logged: {bot_info["name"]} -> {request_data["page_url"]}')
                
        except Exception as error:
            print(f'[AI Bot Tracker Flask] Error processing bot visit: {error}')
    
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
            print(f'[AI Bot Tracker Flask] Database logging error: {error}')
    
    def get_stats(self):
        """Get visit statistics"""
        if not self.database:
            raise Exception('Database not initialized')
        
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
            raise Exception('Database not initialized')
        
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


def create_bot_tracker(**kwargs):
    """Factory function to create a bot tracker instance"""
    return AiBotTrackerFlask(**kwargs)


# Decorator for route-specific bot tracking
def track_bots(tracker_instance=None, **options):
    """Decorator to enable bot tracking for specific routes"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # This decorator can be used for route-specific tracking logic
            # For now, it just calls the original function
            return f(*args, **kwargs)
        return decorated_function
    return decorator