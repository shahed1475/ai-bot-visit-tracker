#!/usr/bin/env python3
"""
Django Basic Usage Example for AI Bot Visit Tracker

This example demonstrates how to integrate the AI Bot Visit Tracker
into a Django application with various configuration options.

Installation:
    pip install django sqlite3

Setup:
    1. Create a new Django project: django-admin startproject bot_tracker_demo
    2. Replace the contents of settings.py and urls.py with the configurations below
    3. Add this file as views.py in your Django app
    4. Run: python manage.py runserver

Usage:
    python manage.py runserver
    
Then visit: http://localhost:8000
"""

import os
import sys
import json
from django.http import JsonResponse, HttpResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.views import View
from django.template import Template, Context

# Add the middleware path
sys.path.append(os.path.join(os.path.dirname(__file__), '../'))

from ai_bot_tracker_django import AiBotTrackerView, track_bots

# Initialize bot tracker view helper
bot_tracker_view = AiBotTrackerView()

# Basic HTML template for demo pages
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ title }}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .content { line-height: 1.6; }
        .api-link { display: inline-block; margin: 10px; padding: 10px 15px; background: #007bff; color: white; text-decoration: none; border-radius: 3px; }
        .api-link:hover { background: #0056b3; }
        .bot-info { background: #e9ecef; padding: 15px; border-radius: 5px; margin: 10px 0; }
        pre { background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="header">
        <h1>{{ title }}</h1>
        <p>{{ description }}</p>
    </div>
    <div class="content">
        {{ content|safe }}
    </div>
</body>
</html>
"""

def home(request):
    """Home page - demonstrates basic bot tracking"""
    content = """
    <h2>Welcome to the AI Bot Visit Tracker Demo</h2>
    <p>This Django application demonstrates AI bot detection and logging capabilities.</p>
    
    <div class="bot-info">
        <h3>🤖 Bot Detection Active</h3>
        <p>This page automatically detects and logs visits from AI bots including:</p>
        <ul>
            <li>GoogleBot (Google Search)</li>
            <li>BingBot (Microsoft Bing)</li>
            <li>GPTBot (OpenAI ChatGPT)</li>
            <li>ClaudeBot (Anthropic Claude)</li>
            <li>PerplexityBot (Perplexity AI)</li>
            <li>And many more...</li>
        </ul>
    </div>
    
    <h3>📊 Available Endpoints</h3>
    <a href="/api/stats/" class="api-link">View Bot Statistics</a>
    <a href="/api/visits/" class="api-link">Recent Bot Visits</a>
    <a href="/simulate/googlebot/" class="api-link">Simulate GoogleBot</a>
    <a href="/content/article/" class="api-link">Sample Article</a>
    <a href="/search/?q=test" class="api-link">Search Page</a>
    """
    
    template = Template(HTML_TEMPLATE)
    context = Context({
        'title': 'AI Bot Visit Tracker - Django Demo',
        'description': 'Demonstrating AI bot detection and logging in Django',
        'content': content
    })
    
    return HttpResponse(template.render(context))

def article(request):
    """Sample article page - typically indexed by bots"""
    content = """
    <h2>📄 Sample Article Page</h2>
    <p>This is a sample content page that would typically be indexed by search engine bots.</p>
    
    <article>
        <h3>Understanding AI Bot Behavior</h3>
        <p>AI bots visit websites for various purposes:</p>
        <ul>
            <li><strong>Indexing:</strong> Crawling content for search engines</li>
            <li><strong>Retrieval:</strong> Fetching specific information for AI responses</li>
            <li><strong>Monitoring:</strong> Checking for changes or updates</li>
        </ul>
        
        <p>Our bot tracker classifies these visits and provides insights into bot behavior patterns.</p>
    </article>
    
    <p><a href="/">← Back to Home</a></p>
    """
    
    template = Template(HTML_TEMPLATE)
    context = Context({
        'title': 'Sample Article - AI Bot Tracker',
        'description': 'A sample article page for bot indexing demonstration',
        'content': content
    })
    
    return HttpResponse(template.render(context))

def search(request):
    """Search page - typically used for retrieval by AI bots"""
    query = request.GET.get('q', '')
    
    content = f"""
    <h2>🔍 Search Results</h2>
    <p>Search query: <strong>{query or 'No query provided'}</strong></p>
    
    <div class="bot-info">
        <h3>🎯 Retrieval Classification</h3>
        <p>Search pages are typically classified as "retrieval" requests when accessed by AI bots,
        as they're looking for specific information rather than indexing general content.</p>
    </div>
    
    <h3>Mock Search Results:</h3>
    <ul>
        <li>Result 1: Understanding AI Bot Detection</li>
        <li>Result 2: Web Scraping vs. Bot Crawling</li>
        <li>Result 3: Implementing Bot Tracking in Django</li>
    </ul>
    
    <p><a href="/">← Back to Home</a></p>
    """
    
    template = Template(HTML_TEMPLATE)
    context = Context({
        'title': f'Search: {query}' if query else 'Search',
        'description': 'Search functionality demonstration',
        'content': content
    })
    
    return HttpResponse(template.render(context))

@csrf_exempt
def api_stats(request):
    """API endpoint to get bot visit statistics"""
    try:
        stats = bot_tracker_view.get_stats()
        return JsonResponse({
            'success': True,
            'data': stats,
            'message': 'Bot statistics retrieved successfully'
        })
    except Exception as error:
        return JsonResponse({
            'success': False,
            'error': str(error),
            'message': 'Failed to retrieve bot statistics'
        }, status=500)

@csrf_exempt
def api_visits(request):
    """API endpoint to get recent bot visits"""
    try:
        limit = int(request.GET.get('limit', 50))
        visits = bot_tracker_view.get_recent_visits(limit)
        return JsonResponse({
            'success': True,
            'data': visits,
            'count': len(visits),
            'message': f'Retrieved {len(visits)} recent bot visits'
        })
    except Exception as error:
        return JsonResponse({
            'success': False,
            'error': str(error),
            'message': 'Failed to retrieve bot visits'
        }, status=500)

def simulate_googlebot(request):
    """Simulate a GoogleBot visit for testing"""
    # Get current request headers for display
    headers_dict = dict(request.META)
    headers_json = '\n'.join([f"{k}: {v}" for k, v in headers_dict.items() if k.startswith('HTTP_')])
    
    content = f"""
    <h2>🤖 GoogleBot Simulation</h2>
    <p>This page simulates what a GoogleBot would see when crawling your site.</p>
    
    <div class="bot-info">
        <h3>🔍 Bot Detection</h3>
        <p>If you're accessing this page with a regular browser, it won't be detected as a bot.
        To simulate a real bot visit, you can use curl:</p>
        
        <pre>curl -H "User-Agent: Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" http://localhost:8000/simulate/googlebot/</pre>
    </div>
    
    <h3>📊 Current Request Headers</h3>
    <pre>{headers_json}</pre>
    
    <p><a href="/">← Back to Home</a></p>
    """
    
    template = Template(HTML_TEMPLATE)
    context = Context({
        'title': 'GoogleBot Simulation',
        'description': 'Simulating a GoogleBot visit',
        'content': content
    })
    
    return HttpResponse(template.render(context))

@track_bots()  # Example of using the decorator
def admin_dashboard(request):
    """Admin dashboard with bot tracking decorator"""
    try:
        stats = bot_tracker_view.get_stats()
        recent_visits = bot_tracker_view.get_recent_visits(10)
        
        content = f"""
        <h2>📊 Admin Dashboard</h2>
        <p>Bot tracking statistics and recent activity.</p>
        
        <h3>📈 Statistics</h3>
        <pre>{json.dumps(stats, indent=2)}</pre>
        
        <h3>🕒 Recent Visits (Last 10)</h3>
        <pre>{json.dumps(recent_visits, indent=2)}</pre>
        
        <p><a href="/">← Back to Home</a></p>
        """
        
        template = Template(HTML_TEMPLATE)
        context = Context({
            'title': 'Admin Dashboard',
            'description': 'Bot tracking administration',
            'content': content
        })
        
        return HttpResponse(template.render(context))
    except Exception as error:
        return JsonResponse({'error': str(error)}, status=500)

# Class-based view example
class BotStatsView(View):
    """Class-based view for bot statistics"""
    
    def get(self, request):
        """Handle GET request for bot statistics"""
        try:
            stats = bot_tracker_view.get_stats()
            return JsonResponse({
                'success': True,
                'data': stats,
                'timestamp': str(request.META.get('HTTP_DATE', 'N/A'))
            })
        except Exception as error:
            return JsonResponse({
                'success': False,
                'error': str(error)
            }, status=500)

# Custom 404 handler
def custom_404(request, exception):
    """Custom 404 page"""
    content = """
    <h2>❌ Page Not Found</h2>
    <p>The requested page could not be found.</p>
    <p>Bot visits to non-existent pages are also tracked and logged.</p>
    <p><a href="/">← Back to Home</a></p>
    """
    
    template = Template(HTML_TEMPLATE)
    context = Context({
        'title': '404 - Page Not Found',
        'description': 'Page not found',
        'content': content
    })
    
    return HttpResponse(template.render(context), status=404)

# Custom 500 handler
def custom_500(request):
    """Custom 500 page"""
    content = """
    <h2>⚠️ Server Error</h2>
    <p>An internal server error occurred.</p>
    <p>Bot tracking continues to work even when errors occur.</p>
    <p><a href="/">← Back to Home</a></p>
    """
    
    template = Template(HTML_TEMPLATE)
    context = Context({
        'title': '500 - Server Error',
        'description': 'Internal server error',
        'content': content
    })
    
    return HttpResponse(template.render(context), status=500)


# ============================================================================
# DJANGO CONFIGURATION FILES
# ============================================================================

DJANGO_SETTINGS = '''
"""
Django settings for AI Bot Tracker Demo

Add this configuration to your Django settings.py file.
"""

import os
from pathlib import Path

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = 'django-insecure-demo-key-change-in-production'

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = ['localhost', '127.0.0.1']

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    
    # AI Bot Tracker Middleware (add this line)
    'ai_bot_tracker_django.AiBotTrackerMiddleware',
]

ROOT_URLCONF = 'bot_tracker_demo.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'bot_tracker_demo.wsgi.application'

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# Bot Tracker Configuration
BOT_TRACKER = {
    # Database configuration
    'database_type': 'sqlite',
    'database_path': os.path.join(BASE_DIR, 'data', 'bot_visits.db'),
    
    # Logging configuration
    'enable_logging': True,
    'log_level': 'debug',
    
    # Bot detection configuration
    'custom_bots': [
        {
            'name': 'custom_crawler',
            'patterns': ['custombot', 'mycrawler'],
            'type': 'indexing'
        }
    ],
    
    # Classification configuration
    'classification_rules': {
        'api_endpoints': {
            'patterns': ['/api/', '/search'],
            'classification': 'retrieval'
        },
        'content_pages': {
            'patterns': ['/', '.html'],
            'classification': 'indexing'
        }
    },
    
    # Response configuration
    'add_headers': True,
    'header_prefix': 'X-Bot-Tracker-',
    
    # URL filtering
    'exclude_urls': ['/admin/', '/static/', '/media/'],
    'include_only_urls': None  # If set, only these URLs will be tracked
}

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
'''

DJANGO_URLS = '''
"""
Django URLs configuration for AI Bot Tracker Demo

Add this configuration to your Django urls.py file.
"""

from django.contrib import admin
from django.urls import path
from . import views

# Set custom error handlers
handler404 = 'views.custom_404'
handler500 = 'views.custom_500'

urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),
    
    # Main pages
    path('', views.home, name='home'),
    path('content/article/', views.article, name='article'),
    path('search/', views.search, name='search'),
    path('simulate/googlebot/', views.simulate_googlebot, name='simulate_googlebot'),
    path('admin/dashboard/', views.admin_dashboard, name='admin_dashboard'),
    
    # API endpoints
    path('api/stats/', views.api_stats, name='api_stats'),
    path('api/visits/', views.api_visits, name='api_visits'),
    
    # Class-based view example
    path('api/stats-cbv/', views.BotStatsView.as_view(), name='api_stats_cbv'),
]
'''

if __name__ == '__main__':
    print("🚀 Django AI Bot Tracker Demo Configuration")
    print("\n📋 Setup Instructions:")
    print("1. Create a new Django project: django-admin startproject bot_tracker_demo")
    print("2. Copy the DJANGO_SETTINGS configuration to your settings.py")
    print("3. Copy the DJANGO_URLS configuration to your urls.py")
    print("4. Copy this file as views.py in your Django app")
    print("5. Copy ai_bot_tracker_django.py to your project directory")
    print("6. Run: python manage.py runserver")
    print("\n📊 Dashboard: http://localhost:8000")
    print("📈 API Stats: http://localhost:8000/api/stats/")
    print("🤖 API Visits: http://localhost:8000/api/visits/")
    print("\n🧪 Test with curl:")
    print('curl -H "User-Agent: Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" http://localhost:8000/')
    
    # Save configuration files
    print("\n💾 Saving configuration files...")
    
    with open('django_settings_example.py', 'w') as f:
        f.write(DJANGO_SETTINGS)
    print("✅ Saved: django_settings_example.py")
    
    with open('django_urls_example.py', 'w') as f:
        f.write(DJANGO_URLS)
    print("✅ Saved: django_urls_example.py")
    
    print("\n✨ Configuration files saved! Follow the setup instructions above.")