"""
Advanced Django Example for AI Bot Tracker Middleware
Demonstrates PostgreSQL integration, custom bot patterns, and advanced features
"""

import os
import sys
import django
from django.conf import settings
from django.core.wsgi import get_wsgi_application
from django.http import JsonResponse, HttpResponse
from django.urls import path
from django.core.management import execute_from_command_line
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.views import View
import json

# Add the parent directory to the path to import ai_bot_tracker
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Django settings
if not settings.configured:
    settings.configure(
        DEBUG=True,
        SECRET_KEY='your-secret-key-here-change-in-production',
        
        # Database configuration (PostgreSQL for production)
        DATABASES={
            'default': {
                'ENGINE': 'django.db.backends.postgresql',
                'NAME': os.getenv('DB_NAME', 'ai_bot_tracker'),
                'USER': os.getenv('DB_USER', 'postgres'),
                'PASSWORD': os.getenv('DB_PASSWORD', 'password'),
                'HOST': os.getenv('DB_HOST', 'localhost'),
                'PORT': os.getenv('DB_PORT', '5432'),
            }
        } if os.getenv('USE_POSTGRESQL', 'false').lower() == 'true' else {
            'default': {
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': os.path.join(os.path.dirname(__file__), 'advanced_bot_tracker.db'),
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
        
        # Advanced AI Bot Tracker configuration
        AI_BOT_TRACKER={
            'enable_logging': True,
            'skip_non_bots': True,
            'async_logging': True,
            'log_all_requests': False,
            
            # Custom bot patterns
            'custom_bot_patterns': {
                'CompanyBot': [r'CompanyBot/\d+\.\d+', r'InternalCrawler'],
                'CustomAI': [r'CustomAI', r'MyAIBot'],
                'ResearchBot': [r'ResearchBot', r'AcademicCrawler'],
            },
            
            # IP ranges for known AI services
            'ip_ranges': [
                '66.249.64.0/19',    # Google
                '40.77.167.0/24',    # OpenAI (example)
                '192.168.1.0/24',    # Internal network
            ],
            
            # Custom classification rules
            'classification_rules': {
                'indexing_patterns': [
                    r'/sitemap.*\.xml',
                    r'/robots\.txt',
                    r'/feed',
                    r'/rss',
                    r'/archive/',
                    r'/category/',
                    r'/tag/',
                    r'/page/\d+',
                ],
                'retrieval_patterns': [
                    r'/api/',
                    r'/search',
                    r'/query',
                    r'/ask',
                    r'/chat',
                    r'/assistant',
                    r'/completion',
                    r'/generate',
                ],
                'retrieval_headers': [
                    'x-openai-assistant-id',
                    'x-openai-thread-id',
                    'x-claude-conversation-id',
                    'x-perplexity-session-id',
                    'x-custom-ai-session',
                    'authorization',
                ]
            }
        },
        
        # URL configuration
        ROOT_URLCONF=__name__,
        
        # Cache configuration (for request frequency analysis)
        CACHES={
            'default': {
                'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
                'LOCATION': 'ai-bot-tracker-cache',
            }
        },
        
        # Logging configuration
        LOGGING={
            'version': 1,
            'disable_existing_loggers': False,
            'formatters': {
                'verbose': {
                    'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
                    'style': '{',
                },
            },
            'handlers': {
                'console': {
                    'class': 'logging.StreamHandler',
                    'formatter': 'verbose',
                },
                'file': {
                    'class': 'logging.FileHandler',
                    'filename': 'ai_bot_tracker.log',
                    'formatter': 'verbose',
                },
            },
            'loggers': {
                'ai_bot_tracker': {
                    'handlers': ['console', 'file'],
                    'level': 'INFO',
                    'propagate': False,
                },
                'django': {
                    'handlers': ['console'],
                    'level': 'INFO',
                },
            },
        },
        
        # Time zone
        USE_TZ=True,
        TIME_ZONE='UTC',
        
        # Security settings
        ALLOWED_HOSTS=['*'],  # Configure properly in production
    )

# Initialize Django
django.setup()

# Import after Django setup
from ai_bot_tracker.middleware import AiBotTrackerMiddleware
from ai_bot_tracker.models import BotVisit, BotStats


# Advanced Views
def home(request):
    """Enhanced home page with bot detection info"""
    return JsonResponse({
        'message': 'Advanced AI Bot Tracker Demo',
        'features': [
            'PostgreSQL support',
            'Custom bot patterns',
            'Advanced classification',
            'Real-time analytics',
            'Export capabilities'
        ],
        'endpoints': {
            'api': '/api/',
            'content': '/content/',
            'search': '/search/',
            'admin': '/admin/',
            'metrics': '/metrics/',
            'health': '/health/'
        }
    })


class APIView(View):
    """API endpoints that retrieval bots might access"""
    
    def get(self, request, endpoint=None):
        """Handle GET requests to API endpoints"""
        endpoints = {
            'users': {'data': 'User data', 'type': 'retrieval'},
            'posts': {'data': 'Post data', 'type': 'retrieval'},
            'search': {'data': 'Search results', 'type': 'retrieval'},
            'completion': {'data': 'AI completion', 'type': 'retrieval'},
        }
        
        if endpoint and endpoint in endpoints:
            return JsonResponse(endpoints[endpoint])
        
        return JsonResponse({
            'available_endpoints': list(endpoints.keys()),
            'usage': 'GET /api/{endpoint}/'
        })
    
    @method_decorator(csrf_exempt)
    def post(self, request, endpoint=None):
        """Handle POST requests (typically retrieval)"""
        try:
            data = json.loads(request.body) if request.body else {}
        except json.JSONDecodeError:
            data = {}
        
        return JsonResponse({
            'message': f'POST request to {endpoint}',
            'received_data': data,
            'classification': 'retrieval'
        })


def content_pages(request, page_type, page_id=None):
    """Content pages that indexing bots might crawl"""
    content_types = {
        'articles': 'Article content for indexing',
        'products': 'Product information',
        'categories': 'Category listings',
        'tags': 'Tag pages',
    }
    
    if page_type not in content_types:
        return JsonResponse({'error': 'Content type not found'}, status=404)
    
    return JsonResponse({
        'type': page_type,
        'id': page_id,
        'content': content_types[page_type],
        'classification': 'indexing',
        'seo_data': {
            'title': f'{page_type.title()} - {page_id or "Index"}',
            'description': f'SEO description for {page_type}',
            'keywords': ['ai', 'bot', 'tracking', page_type]
        }
    })


def search_endpoint(request):
    """Search endpoint (retrieval pattern)"""
    query = request.GET.get('q', '')
    
    return JsonResponse({
        'query': query,
        'results': [
            {'title': 'Result 1', 'url': '/content/articles/1/'},
            {'title': 'Result 2', 'url': '/content/articles/2/'},
        ],
        'classification': 'retrieval',
        'total_results': 2
    })


def sitemap_xml(request):
    """Enhanced sitemap for indexing bots"""
    sitemap_content = '''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>http://example.com/</loc>
        <lastmod>2024-01-01</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
    <url>
        <loc>http://example.com/api/</loc>
        <lastmod>2024-01-01</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>
    <url>
        <loc>http://example.com/content/articles/</loc>
        <lastmod>2024-01-01</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.9</priority>
    </url>
</urlset>'''
    
    return HttpResponse(sitemap_content, content_type='application/xml')


def robots_txt(request):
    """Robots.txt file (indexing pattern)"""
    robots_content = '''User-agent: *
Allow: /

User-agent: GPTBot
Allow: /api/
Allow: /content/

User-agent: ClaudeBot
Allow: /api/
Allow: /search/

Sitemap: http://example.com/sitemap.xml
'''
    
    return HttpResponse(robots_content, content_type='text/plain')


# Admin Views
def admin_dashboard(request):
    """Admin dashboard with comprehensive stats"""
    try:
        # Get stats for different time ranges
        stats_24h = AiBotTrackerMiddleware.get_stats(time_range='24h')
        stats_7d = AiBotTrackerMiddleware.get_stats(time_range='7d')
        stats_30d = AiBotTrackerMiddleware.get_stats(time_range='30d')
        
        return JsonResponse({
            'dashboard': 'AI Bot Tracker Admin',
            'stats': {
                '24h': stats_24h,
                '7d': stats_7d,
                '30d': stats_30d
            },
            'actions': {
                'export_csv': '/admin/export/csv/',
                'export_json': '/admin/export/json/',
                'cleanup': '/admin/cleanup/',
                'config': '/admin/config/'
            }
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


def export_data(request, format_type):
    """Export data in different formats"""
    try:
        time_range = request.GET.get('time_range', '24h')
        bot_name = request.GET.get('bot_name')
        classification = request.GET.get('classification')
        
        file_name = f'bot_visits_{time_range}.{format_type}'
        file_path = os.path.join(os.path.dirname(__file__), file_name)
        
        if format_type == 'csv':
            count = AiBotTrackerMiddleware.export_to_csv(
                file_path, time_range, bot_name, classification
            )
        elif format_type == 'json':
            count = AiBotTrackerMiddleware.export_to_json(
                file_path, time_range, bot_name, classification
            )
        else:
            return JsonResponse({'error': 'Unsupported format'}, status=400)
        
        return JsonResponse({
            'message': f'Exported {count} records to {format_type.upper()}',
            'file_path': file_path,
            'filters': {
                'time_range': time_range,
                'bot_name': bot_name,
                'classification': classification
            }
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


def cleanup_old_data(request):
    """Clean up old visit records"""
    try:
        days_to_keep = int(request.GET.get('days', 30))
        deleted_count = AiBotTrackerMiddleware.cleanup_old_visits(days_to_keep)
        
        return JsonResponse({
            'message': f'Cleaned up {deleted_count} old records',
            'days_kept': days_to_keep
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


def bot_config(request):
    """Bot configuration endpoint"""
    from ai_bot_tracker.models import BotConfig
    
    if request.method == 'GET':
        configs = BotConfig.objects.all().values('key', 'value', 'description')
        return JsonResponse({'configs': list(configs)})
    
    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
            config, created = BotConfig.objects.get_or_create(
                key=data['key'],
                defaults={
                    'value': data['value'],
                    'description': data.get('description', '')
                }
            )
            
            if not created:
                config.value = data['value']
                config.description = data.get('description', config.description)
                config.save()
            
            return JsonResponse({
                'message': 'Configuration updated',
                'key': config.key,
                'created': created
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)


def metrics_endpoint(request):
    """Metrics endpoint for monitoring"""
    try:
        from django.db.models import Count, Avg
        from datetime import timedelta
        from django.utils import timezone
        
        now = timezone.now()
        last_hour = now - timedelta(hours=1)
        
        # Get real-time metrics
        recent_visits = BotVisit.objects.filter(timestamp__gte=last_hour)
        
        metrics = {
            'timestamp': now.isoformat(),
            'recent_activity': {
                'total_visits_last_hour': recent_visits.count(),
                'unique_bots_last_hour': recent_visits.values('bot_name').distinct().count(),
                'avg_response_time': recent_visits.aggregate(
                    avg_time=Avg('response_time')
                )['avg_time'] or 0,
            },
            'classification_breakdown': list(
                recent_visits.values('classification').annotate(
                    count=Count('id')
                ).order_by('-count')
            ),
            'top_bots': list(
                recent_visits.values('bot_name').annotate(
                    count=Count('id')
                ).order_by('-count')[:5]
            ),
            'system_health': {
                'database_connected': True,
                'middleware_active': True,
                'async_logging': settings.AI_BOT_TRACKER.get('async_logging', False)
            }
        }
        
        return JsonResponse(metrics)
    except Exception as e:
        return JsonResponse({
            'error': str(e),
            'system_health': {
                'database_connected': False,
                'middleware_active': False
            }
        }, status=500)


def health_check(request):
    """Enhanced health check"""
    try:
        # Check database
        visit_count = BotVisit.objects.count()
        
        # Check recent activity
        from datetime import timedelta
        from django.utils import timezone
        
        recent_count = BotVisit.objects.filter(
            timestamp__gte=timezone.now() - timedelta(hours=24)
        ).count()
        
        return JsonResponse({
            'status': 'healthy',
            'checks': {
                'database': 'ok',
                'middleware': 'active',
                'total_visits': visit_count,
                'recent_visits_24h': recent_count
            },
            'timestamp': timezone.now().isoformat()
        })
    except Exception as e:
        return JsonResponse({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': timezone.now().isoformat()
        }, status=500)


# URL patterns
urlpatterns = [
    path('', home, name='home'),
    
    # API endpoints (retrieval targets)
    path('api/', APIView.as_view(), name='api_root'),
    path('api/<str:endpoint>/', APIView.as_view(), name='api_endpoint'),
    path('search/', search_endpoint, name='search'),
    
    # Content pages (indexing targets)
    path('content/<str:page_type>/', content_pages, name='content_type'),
    path('content/<str:page_type>/<str:page_id>/', content_pages, name='content_page'),
    
    # SEO files (indexing targets)
    path('sitemap.xml', sitemap_xml, name='sitemap'),
    path('robots.txt', robots_txt, name='robots'),
    
    # Admin endpoints
    path('admin/', admin_dashboard, name='admin_dashboard'),
    path('admin/export/<str:format_type>/', export_data, name='export_data'),
    path('admin/cleanup/', cleanup_old_data, name='cleanup'),
    path('admin/config/', bot_config, name='bot_config'),
    
    # Monitoring
    path('metrics/', metrics_endpoint, name='metrics'),
    path('health/', health_check, name='health'),
]

# WSGI application
application = get_wsgi_application()


def run_server():
    """Run the advanced development server"""
    print("Starting Advanced AI Bot Tracker Demo Server...")
    print("Features:")
    print("  ✓ PostgreSQL support (set USE_POSTGRESQL=true)")
    print("  ✓ Custom bot patterns")
    print("  ✓ Advanced classification rules")
    print("  ✓ Real-time metrics")
    print("  ✓ Data export (CSV/JSON)")
    print("  ✓ Configuration management")
    print()
    print("Available endpoints:")
    print("  http://127.0.0.1:8000/ - Home")
    print("  http://127.0.0.1:8000/api/ - API root (retrieval)")
    print("  http://127.0.0.1:8000/api/completion/ - AI completion API")
    print("  http://127.0.0.1:8000/search/?q=test - Search (retrieval)")
    print("  http://127.0.0.1:8000/content/articles/ - Articles (indexing)")
    print("  http://127.0.0.1:8000/sitemap.xml - Sitemap (indexing)")
    print("  http://127.0.0.1:8000/robots.txt - Robots.txt (indexing)")
    print("  http://127.0.0.1:8000/admin/ - Admin dashboard")
    print("  http://127.0.0.1:8000/metrics/ - Real-time metrics")
    print("  http://127.0.0.1:8000/health/ - Health check")
    print()
    print("Test commands:")
    print("  # Test indexing bot")
    print("  curl -H 'User-Agent: GPTBot/1.0' http://127.0.0.1:8000/sitemap.xml")
    print()
    print("  # Test retrieval bot")
    print("  curl -H 'User-Agent: ClaudeBot/1.0' -H 'Referer: https://claude.ai' \\")
    print("       -H 'X-Claude-Conversation-Id: 12345' \\")
    print("       http://127.0.0.1:8000/api/completion/")
    print()
    print("  # Test custom bot")
    print("  curl -H 'User-Agent: CompanyBot/2.0' http://127.0.0.1:8000/content/articles/")
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