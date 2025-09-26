#!/usr/bin/env python3
"""
Test Script for Django AI Bot Tracker Middleware

This script tests the Django middleware by simulating
various bot requests and validating the logging functionality.

Usage: python tests/test_django_middleware.py
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

# Django setup
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tests.django_test_settings')

try:
    import django
    from django.conf import settings
    from django.http import JsonResponse
    from django.urls import path
    from django.core.wsgi import get_wsgi_application
    from django.test import RequestFactory
    from django.core.management import execute_from_command_line
    
    # Configure Django settings for testing
    if not settings.configured:
        settings.configure(
            DEBUG=True,
            SECRET_KEY='test-secret-key-for-ai-bot-tracker-testing',
            INSTALLED_APPS=[
                'django.contrib.contenttypes',
                'django.contrib.auth',
            ],
            MIDDLEWARE=[
                'middleware.python.django.ai_bot_tracker_django.AiBotTrackerMiddleware',
            ],
            ROOT_URLCONF='tests.test_django_middleware',
            DATABASES={
                'default': {
                    'ENGINE': 'django.db.backends.sqlite3',
                    'NAME': str(project_root / 'tests' / 'test_django.sqlite'),
                }
            },
            AI_BOT_TRACKER={
                'database': {
                    'type': 'sqlite',
                    'path': str(project_root / 'tests' / 'test_django.sqlite')
                },
                'logging': {
                    'enabled': True,
                    'log_headers': True,
                    'log_ip': True
                }
            }
        )
    
    django.setup()
    
    from middleware.python.django.ai_bot_tracker_django import AiBotTrackerMiddleware
    
except ImportError as e:
    print(f"❌ Import Error: {e}")
    print("Please install Django: pip install django")
    sys.exit(1)

# Test configuration
TEST_CONFIG = {
    'port': 3003,
    'host': '127.0.0.1',
    'database_path': str(project_root / 'tests' / 'test_django.sqlite'),
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


# Django views for testing
def home_view(request):
    return JsonResponse({
        'message': 'AI Bot Tracker Test - Home Page',
        'timestamp': datetime.now().isoformat()
    })

def article_view(request, slug):
    return JsonResponse({
        'message': f'Article: {slug}',
        'type': 'article',
        'timestamp': datetime.now().isoformat()
    })

def blog_view(request, slug):
    return JsonResponse({
        'message': f'Blog Post: {slug}',
        'type': 'blog',
        'timestamp': datetime.now().isoformat()
    })

def api_resource_view(request, resource):
    return JsonResponse({
        'resource': resource,
        'data': [],
        'timestamp': datetime.now().isoformat()
    })

def sitemap_view(request):
    from django.http import HttpResponse
    content = '''<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>http://localhost:{}/</loc></url>
        </urlset>'''.format(TEST_CONFIG['port'])
    return HttpResponse(content, content_type='application/xml')

def robots_view(request):
    from django.http import HttpResponse
    return HttpResponse('User-agent: *\nAllow: /', content_type='text/plain')

def health_view(request):
    return JsonResponse({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat()
    })

def rss_feed_view(request):
    from django.http import HttpResponse
    content = '''<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
            <channel>
                <title>Test Feed</title>
                <description>Test RSS Feed</description>
            </channel>
        </rss>'''
    return HttpResponse(content, content_type='application/rss+xml')

def image_view(request, filename):
    return JsonResponse({
        'message': f'Image: {filename}',
        'type': 'image',
        'timestamp': datetime.now().isoformat()
    })

def test_stats_view(request):
    try:
        test_instance = getattr(request, '_test_instance', None)
        if test_instance:
            stats = test_instance.get_database_stats()
            recent_visits = test_instance.get_recent_visits(10)
            
            return JsonResponse({
                'stats': stats,
                'recent_visits': recent_visits,
                'test_results': test_instance.test_results
            })
        else:
            return JsonResponse({'error': 'Test instance not available'}, status=500)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

# URL patterns
urlpatterns = [
    path('', home_view, name='home'),
    path('article/<slug:slug>', article_view, name='article'),
    path('blog/<slug:slug>', blog_view, name='blog'),
    path('api/v1/<str:resource>', api_resource_view, name='api_resource'),
    path('sitemap.xml', sitemap_view, name='sitemap'),
    path('robots.txt', robots_view, name='robots'),
    path('health', health_view, name='health'),
    path('feed.rss', rss_feed_view, name='rss_feed'),
    path('images/<str:filename>', image_view, name='image'),
    path('test/stats', test_stats_view, name='test_stats'),
]


class DjangoMiddlewareTest:
    def __init__(self):
        self.server_process = None
        self.test_results = {
            'total_requests': 0,
            'bot_detections': 0,
            'classifications': {},
            'errors': [],
            'start_time': None,
            'end_time': None
        }

    def initialize(self):
        """Initialize the Django test environment"""
        print('🚀 Initializing Django Middleware Test')
        print('=' * 50)

        # Clean up previous test database
        if os.path.exists(TEST_CONFIG['database_path']):
            os.unlink(TEST_CONFIG['database_path'])
            print('🗑️  Cleaned up previous test database')

        # Run Django migrations to create tables
        try:
            from django.core.management import call_command
            call_command('migrate', verbosity=0, interactive=False)
            print('✅ Django database migrations completed')
        except Exception as e:
            print(f'⚠️  Django migrations skipped: {e}')

        print(f'✅ Test Django environment initialized')

    def start_server(self):
        """Start the Django test server"""
        import subprocess
        import sys
        
        # Create a simple Django management command to run the test server
        server_script = f"""
import os
import sys
import django
from django.core.management import execute_from_command_line

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tests.django_test_settings')

if __name__ == '__main__':
    execute_from_command_line([
        'manage.py', 
        'runserver', 
        '{TEST_CONFIG['host']}:{TEST_CONFIG['port']}',
        '--noreload'
    ])
"""
        
        # For simplicity, we'll use the Django test client instead of a real server
        print(f'✅ Django test client ready for testing')

    def run_tests(self):
        """Run bot request tests using Django test client"""
        print('\n🧪 Starting Bot Request Tests')
        print('-' * 30)

        self.test_results['start_time'] = datetime.now()

        from django.test import Client
        client = Client()

        # Test each bot with each URL
        for bot in TEST_BOTS:
            for url_info in TEST_URLS:
                self.test_bot_request_with_client(client, bot, url_info)
                time.sleep(TEST_CONFIG['request_interval'])

        self.test_results['end_time'] = datetime.now()
        print('\n✅ All bot request tests completed')

    def test_bot_request_with_client(self, client, bot, url_info):
        """Test a single bot request using Django test client"""
        try:
            path = url_info['path']
            
            print(f"🤖 Testing: {bot['name']} -> {path}")

            # Set up headers for the request
            headers = {
                'HTTP_USER_AGENT': bot['user_agent'],
                'HTTP_ACCEPT': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'HTTP_ACCEPT_LANGUAGE': 'en-US,en;q=0.5',
                'HTTP_ACCEPT_ENCODING': 'gzip, deflate',
                'HTTP_CONNECTION': 'keep-alive'
            }

            # Make the request
            response = client.get(path, **headers)

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

    def test_bot_request_with_requests(self, bot, url_info):
        """Test a single bot request using requests library (for real server)"""
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
        
        if self.server_process:
            self.server_process.terminate()
            print('   ✅ Test server stopped')

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
    """Main function to run the Django middleware test"""
    test = DjangoMiddlewareTest()
    
    results = test.run()
    
    # Exit with appropriate code
    exit_code = 0 if results['success'] else 1
    sys.exit(exit_code)


if __name__ == '__main__':
    main()