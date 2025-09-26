import os
import sys
import json
import sqlite3
import psycopg2
from datetime import datetime, timedelta
from functools import wraps
from flask import Flask, request, g, jsonify
import re
import ipaddress
from typing import Dict, List, Optional, Tuple, Any
import csv
import threading
import queue
import time

# Add the core directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'core'))

class BotDetector:
    """Python implementation of bot detection logic"""
    
    def __init__(self, custom_patterns=None, ip_ranges=None):
        self.bot_patterns = {
            'GPTBot': [r'GPTBot', r'ChatGPT-User'],
            'ClaudeBot': [r'ClaudeBot', r'Claude-Web'],
            'GoogleBot': [r'Googlebot', r'Google-Extended', r'Bard'],
            'BingBot': [r'bingbot', r'BingPreview', r'EdgeBot'],
            'PerplexityBot': [r'PerplexityBot'],
            'FacebookBot': [r'facebookexternalhit', r'Meta-ExternalAgent'],
            'TwitterBot': [r'Twitterbot'],
            'LinkedInBot': [r'LinkedInBot'],
            'SlackBot': [r'Slackbot'],
            'TelegramBot': [r'TelegramBot'],
            'WhatsAppBot': [r'WhatsApp'],
            'AppleBot': [r'Applebot'],
            'YandexBot': [r'YandexBot'],
            'BaiduBot': [r'Baiduspider'],
            'DuckDuckBot': [r'DuckDuckBot'],
            'AhrefsBot': [r'AhrefsBot'],
            'SemrushBot': [r'SemrushBot'],
            'MJ12Bot': [r'MJ12bot'],
            'DotBot': [r'DotBot']
        }
        
        if custom_patterns:
            self.bot_patterns.update(custom_patterns)
        
        self.ip_ranges = ip_ranges or []
        self._compile_patterns()
    
    def _compile_patterns(self):
        """Compile regex patterns for better performance"""
        self.compiled_patterns = {}
        for bot_name, patterns in self.bot_patterns.items():
            self.compiled_patterns[bot_name] = [
                re.compile(pattern, re.IGNORECASE) for pattern in patterns
            ]
    
    def detect_bot(self, user_agent: str, ip_address: str) -> Dict[str, Any]:
        """Detect if request is from a bot"""
        if not user_agent:
            return {'is_bot': False, 'bot_name': None, 'confidence': 0.0}
        
        # Check user agent patterns
        for bot_name, patterns in self.compiled_patterns.items():
            for pattern in patterns:
                if pattern.search(user_agent):
                    confidence = 0.9
                    
                    # Increase confidence if IP is from known ranges
                    if self._check_ip_ranges(ip_address):
                        confidence = 0.95
                    
                    return {
                        'is_bot': True,
                        'bot_name': bot_name,
                        'confidence': confidence,
                        'detection_method': 'user_agent'
                    }
        
        # Check IP ranges only
        if self._check_ip_ranges(ip_address):
            return {
                'is_bot': True,
                'bot_name': 'Unknown',
                'confidence': 0.7,
                'detection_method': 'ip_range'
            }
        
        return {'is_bot': False, 'bot_name': None, 'confidence': 0.0}
    
    def _check_ip_ranges(self, ip_address: str) -> bool:
        """Check if IP address is in known bot ranges"""
        if not self.ip_ranges or not ip_address:
            return False
        
        try:
            ip = ipaddress.ip_address(ip_address)
            for ip_range in self.ip_ranges:
                if ip in ipaddress.ip_network(ip_range, strict=False):
                    return True
        except (ValueError, ipaddress.AddressValueError):
            pass
        
        return False

class RequestClassifier:
    """Python implementation of request classification logic"""
    
    def __init__(self, custom_rules=None):
        self.indexing_patterns = [
            r'/sitemap\.xml',
            r'/robots\.txt',
            r'\.xml$',
            r'/feed',
            r'/rss'
        ]
        
        self.retrieval_patterns = [
            r'/search',
            r'/api/',
            r'/query',
            r'\.json$'
        ]
        
        self.retrieval_headers = [
            'x-openai-assistant-id',
            'x-claude-request-id',
            'x-perplexity-session',
            'x-anthropic-version'
        ]
        
        if custom_rules:
            self.indexing_patterns.extend(custom_rules.get('indexing_patterns', []))
            self.retrieval_patterns.extend(custom_rules.get('retrieval_patterns', []))
            self.retrieval_headers.extend(custom_rules.get('retrieval_headers', []))
        
        self._compile_patterns()
        self.request_history = {}
    
    def _compile_patterns(self):
        """Compile regex patterns for better performance"""
        self.compiled_indexing = [re.compile(p, re.IGNORECASE) for p in self.indexing_patterns]
        self.compiled_retrieval = [re.compile(p, re.IGNORECASE) for p in self.retrieval_patterns]
    
    def classify_request(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """Classify request as indexing or retrieval"""
        url = request_data.get('url', '')
        headers = request_data.get('headers', {})
        ip_address = request_data.get('ip_address', '')
        user_agent = request_data.get('user_agent', '')
        
        indexing_score = 0
        retrieval_score = 0
        reasons = []
        
        # URL pattern analysis
        for pattern in self.compiled_indexing:
            if pattern.search(url):
                indexing_score += 0.3
                reasons.append(f"URL matches indexing pattern: {pattern.pattern}")
        
        for pattern in self.compiled_retrieval:
            if pattern.search(url):
                retrieval_score += 0.3
                reasons.append(f"URL matches retrieval pattern: {pattern.pattern}")
        
        # Header analysis
        referer = headers.get('referer', '').lower()
        if referer:
            retrieval_score += 0.2
            reasons.append("Has referer header")
            
            # Check for AI platform referers
            ai_platforms = ['openai.com', 'claude.ai', 'perplexity.ai', 'chat.openai.com']
            if any(platform in referer for platform in ai_platforms):
                retrieval_score += 0.3
                reasons.append("Referer from AI platform")
        else:
            indexing_score += 0.1
            reasons.append("No referer header")
        
        # Special headers
        for header in self.retrieval_headers:
            if header.lower() in [h.lower() for h in headers.keys()]:
                retrieval_score += 0.4
                reasons.append(f"Has special header: {header}")
        
        # Request frequency analysis
        frequency_score, frequency_reason = self._analyze_request_frequency(ip_address, user_agent)
        if frequency_score > 0:
            indexing_score += frequency_score
            reasons.append(frequency_reason)
        elif frequency_score < 0:
            retrieval_score += abs(frequency_score)
            reasons.append(frequency_reason)
        
        # Determine classification
        if retrieval_score > indexing_score:
            classification = 'retrieval'
            confidence = min(retrieval_score, 1.0)
        else:
            classification = 'indexing'
            confidence = min(indexing_score, 1.0)
        
        return {
            'classification': classification,
            'confidence': confidence,
            'indexing_score': indexing_score,
            'retrieval_score': retrieval_score,
            'reasons': reasons
        }
    
    def _analyze_request_frequency(self, ip_address: str, user_agent: str) -> Tuple[float, str]:
        """Analyze request frequency patterns"""
        key = f"{ip_address}:{user_agent}"
        current_time = datetime.now()
        
        if key not in self.request_history:
            self.request_history[key] = []
        
        # Clean old entries (older than 1 hour)
        self.request_history[key] = [
            timestamp for timestamp in self.request_history[key]
            if current_time - timestamp < timedelta(hours=1)
        ]
        
        # Add current request
        self.request_history[key].append(current_time)
        
        request_count = len(self.request_history[key])
        
        if request_count >= 10:  # High frequency suggests indexing
            return 0.2, "High request frequency (indexing behavior)"
        elif request_count <= 2:  # Low frequency suggests retrieval
            return -0.1, "Low request frequency (retrieval behavior)"
        
        return 0, "Normal request frequency"

class DatabaseManager:
    """Database management for bot visit tracking"""
    
    def __init__(self, config):
        self.config = config
        self.connection = None
        self.db_type = config.get('type', 'sqlite')
    
    def connect(self):
        """Connect to database"""
        if self.db_type == 'sqlite':
            db_path = self.config.get('path', 'bot_visits.db')
            os.makedirs(os.path.dirname(db_path) if os.path.dirname(db_path) else '.', exist_ok=True)
            self.connection = sqlite3.connect(db_path, check_same_thread=False)
            self.connection.row_factory = sqlite3.Row
        elif self.db_type == 'postgresql':
            self.connection = psycopg2.connect(
                host=self.config.get('host', 'localhost'),
                port=self.config.get('port', 5432),
                user=self.config.get('username', 'postgres'),
                password=self.config.get('password', ''),
                database=self.config.get('database', 'bot_tracker')
            )
        else:
            raise ValueError(f"Unsupported database type: {self.db_type}")
    
    def initialize_schema(self):
        """Initialize database schema"""
        if self.db_type == 'sqlite':
            schema_sql = '''
            CREATE TABLE IF NOT EXISTS visits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                ip_address TEXT NOT NULL,
                bot_name TEXT,
                page_url TEXT NOT NULL,
                headers TEXT,
                classification TEXT,
                classification_confidence REAL,
                classification_reason TEXT,
                user_agent TEXT,
                referer TEXT,
                request_method TEXT,
                response_status INTEGER,
                response_time INTEGER
            );
            
            CREATE INDEX IF NOT EXISTS idx_visits_timestamp ON visits(timestamp);
            CREATE INDEX IF NOT EXISTS idx_visits_bot_name ON visits(bot_name);
            CREATE INDEX IF NOT EXISTS idx_visits_classification ON visits(classification);
            '''
        else:  # PostgreSQL
            schema_sql = '''
            CREATE TABLE IF NOT EXISTS visits (
                id SERIAL PRIMARY KEY,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ip_address VARCHAR(45) NOT NULL,
                bot_name VARCHAR(100),
                page_url TEXT NOT NULL,
                headers TEXT,
                classification VARCHAR(20),
                classification_confidence REAL,
                classification_reason TEXT,
                user_agent TEXT,
                referer TEXT,
                request_method VARCHAR(10),
                response_status INTEGER,
                response_time INTEGER
            );
            
            CREATE INDEX IF NOT EXISTS idx_visits_timestamp ON visits(timestamp);
            CREATE INDEX IF NOT EXISTS idx_visits_bot_name ON visits(bot_name);
            CREATE INDEX IF NOT EXISTS idx_visits_classification ON visits(classification);
            '''
        
        cursor = self.connection.cursor()
        cursor.executescript(schema_sql) if self.db_type == 'sqlite' else cursor.execute(schema_sql)
        self.connection.commit()
        cursor.close()
    
    def log_visit(self, visit_data):
        """Log a bot visit to database"""
        sql = '''
        INSERT INTO visits (
            timestamp, ip_address, bot_name, page_url, headers,
            classification, classification_confidence, classification_reason,
            user_agent, referer, request_method
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        '''
        
        cursor = self.connection.cursor()
        cursor.execute(sql, (
            visit_data.get('timestamp'),
            visit_data.get('ip_address'),
            visit_data.get('bot_name'),
            visit_data.get('page_url'),
            json.dumps(visit_data.get('headers', {})),
            visit_data.get('classification'),
            visit_data.get('classification_confidence'),
            visit_data.get('classification_reason'),
            visit_data.get('user_agent'),
            visit_data.get('referer'),
            visit_data.get('request_method')
        ))
        self.connection.commit()
        cursor.close()
    
    def get_stats(self, options=None):
        """Get statistics about bot visits"""
        options = options or {}
        
        # Build WHERE clause based on options
        where_conditions = []
        params = []
        
        if options.get('time_range'):
            time_range = options['time_range']
            if time_range == '1h':
                where_conditions.append("timestamp >= datetime('now', '-1 hour')")
            elif time_range == '24h':
                where_conditions.append("timestamp >= datetime('now', '-1 day')")
            elif time_range == '7d':
                where_conditions.append("timestamp >= datetime('now', '-7 days')")
            elif time_range == '30d':
                where_conditions.append("timestamp >= datetime('now', '-30 days')")
        
        if options.get('bot_name'):
            where_conditions.append("bot_name = ?")
            params.append(options['bot_name'])
        
        if options.get('classification'):
            where_conditions.append("classification = ?")
            params.append(options['classification'])
        
        where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
        
        # Get basic stats
        stats_sql = f'''
        SELECT 
            COUNT(*) as total_visits,
            COUNT(DISTINCT ip_address) as unique_ips,
            COUNT(DISTINCT bot_name) as unique_bots,
            AVG(classification_confidence) as avg_confidence
        FROM visits 
        WHERE {where_clause}
        '''
        
        cursor = self.connection.cursor()
        cursor.execute(stats_sql, params)
        basic_stats = dict(cursor.fetchone())
        
        # Get bot breakdown
        bot_sql = f'''
        SELECT bot_name, COUNT(*) as count
        FROM visits 
        WHERE {where_clause} AND bot_name IS NOT NULL
        GROUP BY bot_name
        ORDER BY count DESC
        '''
        
        cursor.execute(bot_sql, params)
        bot_stats = [dict(row) for row in cursor.fetchall()]
        
        # Get classification breakdown
        class_sql = f'''
        SELECT classification, COUNT(*) as count
        FROM visits 
        WHERE {where_clause} AND classification IS NOT NULL
        GROUP BY classification
        '''
        
        cursor.execute(class_sql, params)
        classification_stats = [dict(row) for row in cursor.fetchall()]
        
        cursor.close()
        
        return {
            'basic_stats': basic_stats,
            'bot_breakdown': bot_stats,
            'classification_breakdown': classification_stats
        }
    
    def export_to_csv(self, file_path, options=None):
        """Export data to CSV file"""
        options = options or {}
        
        # Build query
        where_conditions = []
        params = []
        
        if options.get('time_range'):
            time_range = options['time_range']
            if time_range == '24h':
                where_conditions.append("timestamp >= datetime('now', '-1 day')")
            elif time_range == '7d':
                where_conditions.append("timestamp >= datetime('now', '-7 days')")
        
        where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
        
        sql = f'''
        SELECT timestamp, ip_address, bot_name, page_url, classification,
               classification_confidence, user_agent, referer, request_method
        FROM visits 
        WHERE {where_clause}
        ORDER BY timestamp DESC
        '''
        
        cursor = self.connection.cursor()
        cursor.execute(sql, params)
        
        os.makedirs(os.path.dirname(file_path) if os.path.dirname(file_path) else '.', exist_ok=True)
        
        with open(file_path, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow([
                'Timestamp', 'IP Address', 'Bot Name', 'Page URL', 'Classification',
                'Confidence', 'User Agent', 'Referer', 'Method'
            ])
            
            for row in cursor.fetchall():
                writer.writerow(row)
        
        cursor.close()
        return file_path
    
    def close(self):
        """Close database connection"""
        if self.connection:
            self.connection.close()

class AiBotTracker:
    """Main Flask middleware class for AI bot tracking"""
    
    def __init__(self, app=None, **config):
        self.app = app
        self.config = {
            'database': {
                'type': 'sqlite',
                'path': './bot_visits.db'
            },
            'enable_logging': True,
            'skip_non_bots': True,
            'async_logging': True,
            'custom_bot_patterns': {},
            'ip_ranges': [],
            'classification_rules': {}
        }
        self.config.update(config)
        
        self.bot_detector = BotDetector(
            custom_patterns=self.config.get('custom_bot_patterns'),
            ip_ranges=self.config.get('ip_ranges')
        )
        
        self.classifier = RequestClassifier(
            custom_rules=self.config.get('classification_rules')
        )
        
        self.db_manager = DatabaseManager(self.config['database'])
        
        # Async logging setup
        if self.config.get('async_logging'):
            self.log_queue = queue.Queue()
            self.log_thread = threading.Thread(target=self._async_logger, daemon=True)
            self.log_thread.start()
        
        self.initialized = False
        
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize the Flask app with the middleware"""
        self.app = app
        app.before_request(self._before_request)
        app.after_request(self._after_request)
        
        # Initialize database
        if not self.initialized:
            self._initialize()
    
    def _initialize(self):
        """Initialize database connection and schema"""
        try:
            self.db_manager.connect()
            self.db_manager.initialize_schema()
            self.initialized = True
            
            if self.config.get('enable_logging'):
                print('[AiBotTracker] Initialized successfully')
        except Exception as e:
            print(f'[AiBotTracker] Initialization failed: {e}')
            raise
    
    def _before_request(self):
        """Process request before handling"""
        g.start_time = time.time()
        
        # Detect bot
        user_agent = request.headers.get('User-Agent', '')
        ip_address = request.remote_addr or request.environ.get('HTTP_X_FORWARDED_FOR', '')
        
        bot_info = self.bot_detector.detect_bot(user_agent, ip_address)
        g.bot_info = bot_info
        
        # Skip non-bots if configured
        if self.config.get('skip_non_bots') and not bot_info.get('is_bot'):
            return
        
        # Prepare request data for classification
        request_data = {
            'url': request.url,
            'headers': dict(request.headers),
            'ip_address': ip_address,
            'user_agent': user_agent
        }
        
        # Classify request
        classification_info = self.classifier.classify_request(request_data)
        g.classification_info = classification_info
    
    def _after_request(self, response):
        """Process request after handling"""
        if not hasattr(g, 'bot_info'):
            return response
        
        # Skip non-bots if configured
        if self.config.get('skip_non_bots') and not g.bot_info.get('is_bot'):
            return response
        
        # Prepare visit data
        visit_data = {
            'timestamp': datetime.now().isoformat(),
            'ip_address': request.remote_addr or request.environ.get('HTTP_X_FORWARDED_FOR', ''),
            'bot_name': g.bot_info.get('bot_name'),
            'page_url': request.url,
            'headers': dict(request.headers),
            'classification': getattr(g, 'classification_info', {}).get('classification'),
            'classification_confidence': getattr(g, 'classification_info', {}).get('confidence'),
            'classification_reason': '; '.join(getattr(g, 'classification_info', {}).get('reasons', [])),
            'user_agent': request.headers.get('User-Agent', ''),
            'referer': request.headers.get('Referer', ''),
            'request_method': request.method,
            'response_status': response.status_code,
            'response_time': int((time.time() - getattr(g, 'start_time', time.time())) * 1000)
        }
        
        # Log visit
        if self.config.get('async_logging'):
            self.log_queue.put(visit_data)
        else:
            try:
                self.db_manager.log_visit(visit_data)
            except Exception as e:
                if self.config.get('enable_logging'):
                    print(f'[AiBotTracker] Logging error: {e}')
        
        return response
    
    def _async_logger(self):
        """Async logging worker thread"""
        while True:
            try:
                visit_data = self.log_queue.get(timeout=1)
                self.db_manager.log_visit(visit_data)
                self.log_queue.task_done()
            except queue.Empty:
                continue
            except Exception as e:
                if self.config.get('enable_logging'):
                    print(f'[AiBotTracker] Async logging error: {e}')
    
    def get_stats(self, **options):
        """Get bot visit statistics"""
        return self.db_manager.get_stats(options)
    
    def export_to_csv(self, file_path, **options):
        """Export data to CSV"""
        return self.db_manager.export_to_csv(file_path, options)
    
    def close(self):
        """Close database connections"""
        self.db_manager.close()

# Convenience functions
def create_bot_tracker(**config):
    """Create a bot tracker instance"""
    return AiBotTracker(**config)

def init_bot_tracker(app, **config):
    """Initialize bot tracker with Flask app"""
    tracker = AiBotTracker(**config)
    tracker.init_app(app)
    return tracker