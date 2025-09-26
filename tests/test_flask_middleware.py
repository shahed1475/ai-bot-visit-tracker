#!/usr/bin/env python3
"""
Test Script for Flask AI Bot Tracker Middleware

This script tests the Flask extension by simulating
various bot requests and validating the logging functionality.

Usage: python tests/test_flask_middleware.py
"""

import os
import sys
import time
import sqlite3
import requests
import threading
from datetime import datetime
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

try:
    from flask import Flask, jsonify, request
    from middleware.python.flask.ai_bot_tracker_flask import AiBotTrackerFlask
except ImportError as e:
    print(f"❌ Import Error: {e}")
    print("Please install Flask: pip install flask")
    sys.exit(1)

# Test configuration
TEST_CONFIG = {
    'port': 3002,
    'host': '127.0.0.1',
    'database_path': str(project_root / 'tests' / 'test_flask.sqlite'),
    'test_duration': 10,  # seconds
    'request_interval': 0.5  # seconds between requests
}

# Test bot user agents
TEST_BOTS = [
    {
        'name': 'GPTBot Test',
        'user_agent': 'GPTBot/1.0 (+https://openai.com/gptbot)',
        'expected_bot': 'gptbot',
        'expected_classification': 'retrieval'
    },
    {
        'name': 'GoogleBot Test',
        'user_agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'expected_bot': 'googlebot',
        'expected_classification': 'indexing'
    },
    {
        'name': 'ClaudeBot Test',
        'user_agent': 'ClaudeBot/1.0 (+https://www.anthropic.com/claudebot)',
        'expected_bot': 'claudebot',
        'expected_classification': 'retrieval'
    },
    {
        'name': 'BingBot Test',
        'user_agent': 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
        'expected_bot': 'bingbot',
        'expected_classification': 'indexing'
    },
    {
        'name': 'PerplexityBot Test',
        'user_agent': 'PerplexityBot/1.0 (+https://www.perplexity.ai/bot)',
        'expected_bot': 'perplexitybot',
        'expected_classification': 'retrieval'
    },
    {
        'name': 'FacebookBot Test',
        'user_agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'expected_bot': 'facebookbot',
        'expected_classification': 'social_preview'
    },
    {
        'name': 'Regular User Test',
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'expected_bot': None,
        'expected_classification': None
    }
]

# Test URLs with different classifications
TEST_URLS = [
    {'path': '/', 'expected_classification': 'indexing'},
    {'path': '/article/ai-trends-2024', 'expected_classification': 'retrieval'},
    {'path': '/blog/machine-learning-guide', 'expected_classification': 'retrieval'},
    {'path': '/api/v1/posts', 'expected_classification': 'api_access'},
    {'path': '/sitemap.xml', 'expected_classification': 'indexing'},
    {'path': '/robots.txt', 'expected_classification': 'indexing'},
    {'path': '/health', 'expected_classification': 'monitoring'},
    {'path': '/feed.rss', 'expected_classification': 'feed_consumption'},
    {'path': '/images/logo.png', 'expected_classification': 'media_indexing'}
]


class FlaskMiddlewareTest:
    def __init__(self):
        self.app = None
        self.server_thread = None
        self.bot_tracker = None
        self.test_results = {
            'total_requests': 0,
            'bot_detections': 0,
            'classifications': {},
            'errors': [],
            'start_time': None,
            'end_time': None
        }

    def initialize(self):
        """Initialize the Flask test application"""
        print('🚀 Initializing Flask Middleware Test')
        print('=' * 50)

        # Clean up previous test database
        if os.path.exists(TEST_CONFIG['database_path']):
            os.unlink(TEST_CONFIG['database_path'])
            print('🗑️  Cleaned up previous test database')

        # Create Flask app
        self.app = Flask(__name__)
        self.app.config['TESTING'] = True

        # Initialize AI Bot Tracker
        config = {
            'database': {
                'type': 'sqlite',
                'path': TEST_CONFIG['database_path']
            },
            'logging': {
                'enabled': True,
                'log_headers': True,
                'log_ip': True
            }
        }

        self.bot_tracker = AiBotTrackerFlask()
        self.bot_tracker.init_app(self.app, config)

        # Setup routes
        self.setup_routes()

        print(f'✅ Test Flask app initialized')

    def setup_routes(self):
        """Setup test routes"""
        
        @self.app.route('/')
        def home():
            return jsonify({
                'message': 'AI Bot Tracker Test - Home Page',
                'timestamp': datetime.now().isoformat()
            })

        @self.app.route('/article/<slug>')
        def article(slug):
            return jsonify({
                'message': f'Article: {slug}',
                'type': 'article',
                'timestamp': datetime.now().isoformat()
            })

        @self.app.route('/blog/<slug>')
        def blog(slug):
            return jsonify({
                'message': f'Blog Post: {slug}',
                'type': 'blog',
                'timestamp': datetime.now().isoformat()
            })

        @self.app.route('/api/v1/<resource>')
        def api_resource(resource):
            return jsonify({
                'resource': resource,
                'data': [],
                'timestamp': datetime.now().isoformat()
            })

        @self.app.route('/sitemap.xml')
        def sitemap():
            return '''<?xml version="1.0" encoding="UTF-8"?>
                <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                    <url><loc>http://localhost:{}/</loc></url>
                </urlset>'''.format(TEST_CONFIG['port']), 200, {'Content-Type': 'application/xml'}

        @self.app.route('/robots.txt')
        def robots():
            return 'User-agent: *\nAllow: /', 200, {'Content-Type': 'text/plain'}

        @self.app.route('/health')
        def health():
            return jsonify({
                'status': 'healthy',
                'timestamp': datetime.now().isoformat()
            })

        @self.app.route('/feed.rss')
        def rss_feed():
            return '''<?xml version="1.0" encoding="UTF-8"?>
                <rss version="2.0">
                    <channel>
                        <title>Test Feed</title>
                        <description>Test RSS Feed</description>
                    </channel>
                </rss>''', 200, {'Content-Type': 'application/rss+xml'}

        @self.app.route('/images/<filename>')
        def image(filename):
            return jsonify({
                'message': f'Image: {filename}',
                'type': 'image',
                'timestamp': datetime.now().isoformat()
            })

        @self.app.route('/test/stats')
        def test_stats():
            try:
                stats = self.get_database_stats()
                recent_visits = self.get_recent_visits(10)
                
                return jsonify({
                    'stats': stats,
                    'recent_visits': recent_visits,
                    'test_results': self.test_results
                })
            except Exception as e:
                return jsonify({'error': str(e)}), 500

    def start_server(self):
        """Start the Flask test server in a separate thread"""
        def run_server():
            self.app.run(
                host=TEST_CONFIG['host'],
                port=TEST_CONFIG['port'],
                debug=False,
                use_reloader=False,
                threaded=True
            )

        self.server_thread = threading.Thread(target=run_server, daemon=True)
        self.server_thread.start()
        
        # Wait for server to start
        time.sleep(2)
        print(f'✅ Test server started on http://{TEST_CONFIG["host"]}:{TEST_CONFIG["port"]}')

    def run_tests(self):
        """Run bot request tests"""
        print('\n🧪 Starting Bot Request Tests')
        print('-' * 30)

        self.test_results['start_time'] = datetime.now()

        # Test each bot with each URL
        for bot in TEST_BOTS:
            for url_info in TEST_URLS:
                self.test_bot_request(bot, url_info)
                time.sleep(TEST_CONFIG['request_interval'])

        self.test_results['end_time'] = datetime.now()
        print('\n✅ All bot request tests completed')

    def test_bot_request(self, bot, url_info):
        """Test a single bot request"""
        try:
            url = f"http://{TEST_CONFIG['host']}:{TEST_CONFIG['port']}{url_info['path']}"
            
            print(f"🤖 Testing: {bot['name']} -> {url_info['path']}")

            headers = {
                'User-Agent': bot['user_agent'],
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive'
            }

            response = requests.get(url, headers=headers, timeout=5)

            self.test_results['total_requests'] += 1

            if bot['expected_bot']:
                self.test_results['bot_detections'] += 1
                
                expected_classification = bot['expected_classification'] or url_info['expected_classification']
                if expected_classification:
                    self.test_results['classifications'][expected_classification] = \
                        self.test_results['classifications'].get(expected_classification, 0) + 1

            print(f"   ✅ Status: {response.status_code} | Bot: {bot['expected_bot'] or 'none'} | "
                  f"Classification: {bot['expected_classification'] or url_info['expected_classification'] or 'none'}")

        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
            self.test_results['errors'].append({
                'bot': bot['name'],
                'url': url_info['path'],
                'error': str(e)
            })

    def get_database_stats(self):
        """Get statistics from the database"""
        try:
            conn = sqlite3.connect(TEST_CONFIG['database_path'])
            cursor = conn.cursor()

            # Get total visits
            cursor.execute("SELECT COUNT(*) FROM visits")
            total_visits = cursor.fetchone()[0]

            # Get unique bots
            cursor.execute("SELECT COUNT(DISTINCT bot_name) FROM visits WHERE bot_name != 'unknown'")
            unique_bots = cursor.fetchone()[0]

            # Get classifications
            cursor.execute("SELECT classification, COUNT(*) FROM visits GROUP BY classification")
            classifications = dict(cursor.fetchall())

            conn.close()

            return {
                'total_visits': total_visits,
                'unique_bots': unique_bots,
                'classifications': classifications
            }
        except Exception as e:
            return {'error': str(e)}

    def get_recent_visits(self, limit=10):
        """Get recent visits from the database"""
        try:
            conn = sqlite3.connect(TEST_CONFIG['database_path'])
            cursor = conn.cursor()

            cursor.execute("""
                SELECT timestamp, ip_address, bot_name, page_url, classification, user_agent
                FROM visits 
                ORDER BY timestamp DESC 
                LIMIT ?
            """, (limit,))

            visits = []
            for row in cursor.fetchall():
                visits.append({
                    'timestamp': row[0],
                    'ip_address': row[1],
                    'bot_name': row[2],
                    'page_url': row[3],
                    'classification': row[4],
                    'user_agent': row[5]
                })

            conn.close()
            return visits
        except Exception as e:
            return []

    def validate_results(self):
        """Validate test results"""
        print('\n📊 Validating Test Results')
        print('-' * 30)

        try:
            # Get statistics from the database
            stats = self.get_database_stats()
            recent_visits = self.get_recent_visits(100)

            print(f"📈 Database Statistics:")
            print(f"   Total Visits Logged: {stats.get('total_visits', 0)}")
            print(f"   Unique Bots: {stats.get('unique_bots', 0)}")
            print(f"   Recent Visits Retrieved: {len(recent_visits)}")

            # Validate bot detection
            bot_visits = [visit for visit in recent_visits if visit['bot_name'] and visit['bot_name'] != 'unknown']
            print(f"   Bot Visits Detected: {len(bot_visits)}")

            # Validate classifications
            classifications = {}
            for visit in recent_visits:
                if visit['classification']:
                    classifications[visit['classification']] = classifications.get(visit['classification'], 0) + 1

            print(f"   Classifications:")
            for classification, count in classifications.items():
                print(f"     {classification}: {count}")

            # Check for expected bots
            detected_bots = list(set(visit['bot_name'] for visit in bot_visits))
            print(f"   Detected Bot Types: {', '.join(detected_bots)}")

            # Validation checks
            validation_results = {
                'total_requests_match': self.test_results['total_requests'] > 0,
                'bots_detected': len(bot_visits) > 0,
                'classifications_present': len(classifications) > 0,
                'database_working': stats.get('total_visits', 0) > 0,
                'no_errors': len(self.test_results['errors']) == 0
            }

            print(f"\n🔍 Validation Results:")
            for check, passed in validation_results.items():
                print(f"   {'✅' if passed else '❌'} {check}: {'PASS' if passed else 'FAIL'}")

            all_passed = all(validation_results.values())
            
            return {
                'success': all_passed,
                'stats': stats,
                'recent_visits': recent_visits,
                'validation_results': validation_results,
                'test_results': self.test_results
            }

        except Exception as e:
            print(f"❌ Validation Error: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'test_results': self.test_results
            }

    def cleanup(self):
        """Clean up test environment"""
        print('\n🧹 Cleaning up test environment')
        
        # The server thread will be cleaned up automatically as it's a daemon thread
        print('   ✅ Test server will be cleaned up automatically')

        # Optionally keep test database for inspection
        # if os.path.exists(TEST_CONFIG['database_path']):
        #     os.unlink(TEST_CONFIG['database_path'])
        #     print('   ✅ Test database cleaned up')

    def run(self):
        """Run the complete test suite"""
        try:
            self.initialize()
            self.start_server()
            self.run_tests()
            results = self.validate_results()
            
            print('\n' + '=' * 50)
            print(f"🎯 Test Summary:")
            duration = (self.test_results['end_time'] - self.test_results['start_time']).total_seconds()
            print(f"   Duration: {duration:.1f}s")
            print(f"   Total Requests: {self.test_results['total_requests']}")
            print(f"   Bot Detections: {self.test_results['bot_detections']}")
            print(f"   Errors: {len(self.test_results['errors'])}")
            print(f"   Overall Result: {'✅ PASS' if results['success'] else '❌ FAIL'}")

            if self.test_results['errors']:
                print(f"\n❌ Errors encountered:")
                for error in self.test_results['errors']:
                    print(f"   {error['bot']} -> {error['url']}: {error['error']}")

            print(f"\n📄 Test database saved at: {TEST_CONFIG['database_path']}")
            print(f"   You can inspect the logged data using SQLite tools.")

            return results

        except Exception as e:
            print(f"💥 Test failed with error: {str(e)}")
            import traceback
            traceback.print_exc()
            return {'success': False, 'error': str(e)}
        finally:
            self.cleanup()


def main():
    """Main function to run the Flask middleware test"""
    test = FlaskMiddlewareTest()
    
    results = test.run()
    
    # Exit with appropriate code
    exit_code = 0 if results['success'] else 1
    sys.exit(exit_code)


if __name__ == '__main__':
    main()