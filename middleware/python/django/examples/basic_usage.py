"""
Basic Django Example for AI Bot Tracker Middleware
"""

import os
import sys
import django
from django.conf import settings
from django.core.wsgi import get_wsgi_application
from django.http import JsonResponse, HttpResponse
from django.urls import path, include
from django.core.management import execute_from_command_line

# Add the parent directory to the path to import ai_bot_tracker
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Django settings
if not settings.configured:
    settings.configure(
        DEBUG=True,
        SECRET_KEY='your-secret-key-here-change-in-production',
        
        # Database configuration (SQLite for simplicity)
        DATABASES={
            'default': {
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': os.path.join(os.path.dirname(__file__), 'bot_tracker.db'),
            }
        },
        
        # Installed apps
        INSTALLED_APPS=[
            'django.contrib.contenttypes',
            'django.contrib.auth',
            'ai_bot_tracker',
        ],
        
        # Middleware configuration
        MIDDLEWARE=[
            'django.middleware.security.SecurityMiddleware',
            'ai_bot_tracker.middleware.AiBotTrackerMiddleware',  # Add our middleware
            'django.middleware.common.CommonMiddleware',
        ],
        
        # AI Bot Tracker configuration
        AI_BOT_TRACKER={
            'enable_logging': True,
            'skip_non_bots': True,
            'async_logging': True,
            'log_all_requests': False,  # Only log bot requests
        },
        
        # URL configuration
        ROOT_URLCONF=__name__,
        
        # Logging configuration
        LOGGING={
            'version': 1,
            'disable_existing_loggers': False,
            'handlers': {
                'console': {
                    'class': 'logging.StreamHandler',
                },
            },
            'loggers': {
                'ai_bot_tracker': {
                    'handlers': ['console'],
                    'level': 'INFO',
                },
            },
        },
        
        # Time zone
        USE_TZ=True,
        TIME_ZONE='UTC',
    )

# Initialize Django
django.setup()

# Import after Django setup
from ai_bot_tracker.middleware import AiBotTrackerMiddleware
from ai_bot_tracker.models import BotVisit


# Views
def home(request):
    """Home page"""
    return JsonResponse({
        'message': 'Welcome to AI Bot Tracker Demo',
        'endpoints': {
            'home': '/',
            'api_data': '/api/data/',
            'blog_post': '/blog/sample-post/',
            'sitemap': '/sitemap.xml',
            'stats': '/admin/stats/',
            'export_csv': '/admin/export/csv/',
            'health': '/health/'
        }
    })


def api_data(request):
    """API endpoint that might be accessed by retrieval bots"""
    return JsonResponse({
        'data': 'This is API data that retrieval bots might access',
        'timestamp': '2024-01-01T00:00:00Z',
        'content': 'Sample content for AI bot retrieval'
    })


def blog_post(request, slug):
    """Blog post that might be indexed by bots"""
    return JsonResponse({
        'title': f'Blog Post: {slug}',
        'content': 'This is a sample blog post that indexing bots might crawl',
        'author': 'Demo Author',
        'published': '2024-01-01'
    })


def sitemap_xml(request):
    """Sitemap that indexing bots typically access"""
    sitemap_content = '''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>http://example.com/</loc>
        <lastmod>2024-01-01</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
    <url>
        <loc>http://example.com/api/data/</loc>
        <lastmod>2024-01-01</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>
</urlset>'''
    
    return HttpResponse(sitemap_content, content_type='application/xml')


def admin_stats(request):
    """Get bot visit statistics"""
    try:
        stats = AiBotTrackerMiddleware.get_stats(time_range='24h')
        return JsonResponse(stats)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


def export_csv(request):
    """Export bot visits to CSV"""
    try:
        file_path = os.path.join(os.path.dirname(__file__), 'bot_visits_export.csv')
        count = AiBotTrackerMiddleware.export_to_csv(file_path, time_range='24h')
        
        return JsonResponse({
            'message': f'Exported {count} bot visits to CSV',
            'file_path': file_path
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


def health_check(request):
    """Health check endpoint"""
    try:
        # Check database connectivity
        visit_count = BotVisit.objects.count()
        
        return JsonResponse({
            'status': 'healthy',
            'total_visits': visit_count,
            'timestamp': '2024-01-01T00:00:00Z'
        })
    except Exception as e:
        return JsonResponse({
            'status': 'unhealthy',
            'error': str(e)
        }, status=500)


# URL patterns
urlpatterns = [
    path('', home, name='home'),
    path('api/data/', api_data, name='api_data'),
    path('blog/<slug:slug>/', blog_post, name='blog_post'),
    path('sitemap.xml', sitemap_xml, name='sitemap'),
    path('admin/stats/', admin_stats, name='admin_stats'),
    path('admin/export/csv/', export_csv, name='export_csv'),
    path('health/', health_check, name='health'),
]

# WSGI application
application = get_wsgi_application()


def run_server():
    """Run the development server"""
    print("Starting AI Bot Tracker Demo Server...")
    print("Available endpoints:")
    print("  http://127.0.0.1:8000/ - Home page")
    print("  http://127.0.0.1:8000/api/data/ - API data (retrieval target)")
    print("  http://127.0.0.1:8000/blog/sample-post/ - Blog post (indexing target)")
    print("  http://127.0.0.1:8000/sitemap.xml - Sitemap (indexing target)")
    print("  http://127.0.0.1:8000/admin/stats/ - Bot statistics")
    print("  http://127.0.0.1:8000/admin/export/csv/ - Export to CSV")
    print("  http://127.0.0.1:8000/health/ - Health check")
    print()
    print("Test with different user agents:")
    print("  curl -H 'User-Agent: GPTBot/1.0' http://127.0.0.1:8000/")
    print("  curl -H 'User-Agent: ClaudeBot/1.0' -H 'Referer: https://claude.ai' http://127.0.0.1:8000/api/data/")
    print("  curl -H 'User-Agent: Mozilla/5.0' http://127.0.0.1:8000/")
    print()
    
    # Run migrations
    execute_from_command_line(['manage.py', 'migrate', '--run-syncdb'])
    
    # Start server
    execute_from_command_line(['manage.py', 'runserver', '127.0.0.1:8000'])


if __name__ == '__main__':
    if len(sys.argv) > 1:
        # Handle Django management commands
        execute_from_command_line(sys.argv)
    else:
        # Run the server
        run_server()