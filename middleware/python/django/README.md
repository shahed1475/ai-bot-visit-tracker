# AI Bot Tracker - Django Middleware

A comprehensive Django middleware for detecting, logging, and classifying AI bot visits to your web application.

## Features

- **Multi-Bot Detection**: Supports GPTBot, ClaudeBot, PerplexityBot, and custom patterns
- **Request Classification**: Distinguishes between indexing and retrieval requests
- **Database Integration**: SQLite for development, PostgreSQL for production
- **Asynchronous Logging**: Non-blocking request processing
- **Real-time Analytics**: Live statistics and metrics
- **Data Export**: CSV and JSON export capabilities
- **Configuration Management**: Dynamic bot pattern and rule management
- **Django Integration**: Native Django models, migrations, and admin support

## Quick Start

### 1. Installation

```bash
pip install -r requirements.txt
```

### 2. Add to Django Settings

```python
# settings.py
INSTALLED_APPS = [
    # ... your apps
    'ai_bot_tracker',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'ai_bot_tracker.middleware.AiBotTrackerMiddleware',  # Add this
    # ... other middleware
]

# AI Bot Tracker Configuration
AI_BOT_TRACKER = {
    'enable_logging': True,
    'skip_non_bots': True,
    'async_logging': True,
}
```

### 3. Run Migrations

```bash
python manage.py migrate
```

### 4. Basic Usage

```python
# views.py
from django.http import JsonResponse
from ai_bot_tracker.models import BotVisit

def my_view(request):
    # Your view logic here
    return JsonResponse({'message': 'Hello World'})

def bot_stats(request):
    """Get bot visit statistics"""
    from ai_bot_tracker.middleware import AiBotTrackerMiddleware
    stats = AiBotTrackerMiddleware.get_stats()
    return JsonResponse(stats)
```

## Configuration Options

### Database Configuration

```python
# SQLite (Development)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# PostgreSQL (Production)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'ai_bot_tracker',
        'USER': 'your_user',
        'PASSWORD': 'your_password',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}
```

### AI Bot Tracker Settings

```python
AI_BOT_TRACKER = {
    # Basic settings
    'enable_logging': True,          # Enable/disable logging
    'skip_non_bots': True,          # Only log bot requests
    'async_logging': True,          # Use async logging
    'log_all_requests': False,      # Log all requests (not just bots)
    
    # Custom bot patterns
    'custom_bot_patterns': {
        'CompanyBot': [r'CompanyBot/\d+\.\d+'],
        'CustomAI': [r'CustomAI', r'MyAIBot'],
    },
    
    # IP ranges for known AI services
    'ip_ranges': [
        '66.249.64.0/19',    # Google
        '40.77.167.0/24',    # OpenAI (example)
    ],
    
    # Classification rules
    'classification_rules': {
        'indexing_patterns': [
            r'/sitemap.*\.xml',
            r'/robots\.txt',
            r'/feed',
        ],
        'retrieval_patterns': [
            r'/api/',
            r'/search',
            r'/query',
        ],
        'retrieval_headers': [
            'x-openai-assistant-id',
            'x-claude-conversation-id',
        ]
    }
}
```

## API Reference

### Middleware Methods

```python
from ai_bot_tracker.middleware import AiBotTrackerMiddleware

# Get statistics
stats = AiBotTrackerMiddleware.get_stats(time_range='24h')

# Export data
count = AiBotTrackerMiddleware.export_to_csv('visits.csv', time_range='7d')
count = AiBotTrackerMiddleware.export_to_json('visits.json', bot_name='GPTBot')

# Cleanup old data
deleted = AiBotTrackerMiddleware.cleanup_old_visits(days_to_keep=30)
```

### Models

#### BotVisit

```python
from ai_bot_tracker.models import BotVisit

# Query visits
recent_visits = BotVisit.objects.filter(
    timestamp__gte=timezone.now() - timedelta(days=1)
)

# Get statistics
stats = BotVisit.get_stats(time_range='24h')
bot_stats = BotVisit.get_bot_stats('GPTBot')
```

#### BotStats

```python
from ai_bot_tracker.models import BotStats

# Get daily statistics
daily_stats = BotStats.objects.filter(date=timezone.now().date())
```

#### BotConfig

```python
from ai_bot_tracker.models import BotConfig

# Manage configuration
config = BotConfig.objects.create(
    key='custom_setting',
    value='custom_value',
    description='Custom configuration setting'
)
```

### Request Enhancement

The middleware adds bot information to the request object:

```python
def my_view(request):
    if hasattr(request, 'bot_info'):
        bot_name = request.bot_info['name']
        classification = request.bot_info['classification']
        is_bot = request.bot_info['is_bot']
        
        # Use bot information in your view logic
        if is_bot and classification == 'retrieval':
            # Handle retrieval bot request
            pass
    
    return JsonResponse({'message': 'Hello'})
```

## Supported AI Bots

- **GPTBot** (OpenAI)
- **ClaudeBot** (Anthropic)
- **PerplexityBot** (Perplexity AI)
- **Google-Extended** (Google Bard)
- **ChatGPT-User** (ChatGPT browsing)
- **CCBot** (Common Crawl)
- **anthropic-ai** (Anthropic)
- **Claude-Web** (Claude web interface)

## Classification Logic

### Indexing Requests
- Sequential/frequent crawling patterns
- No referer header
- Accessing sitemap.xml, robots.txt
- Category/archive pages
- RSS/feed endpoints

### Retrieval Requests
- Sporadic access patterns
- Has referer from AI platforms
- Special headers (x-openai-*, x-claude-*)
- API endpoints
- Search/query endpoints
- Real-time data requests

## Database Schema

### visits table
```sql
CREATE TABLE ai_bot_tracker_botvisit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    bot_name VARCHAR(100) NOT NULL,
    page_url TEXT NOT NULL,
    headers TEXT,
    classification VARCHAR(20) NOT NULL,
    user_agent TEXT,
    referer TEXT,
    request_method VARCHAR(10) NOT NULL,
    response_status INTEGER,
    response_time REAL
);
```

### bot_stats table
```sql
CREATE TABLE ai_bot_tracker_botstats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    bot_name VARCHAR(100) NOT NULL,
    total_visits INTEGER NOT NULL,
    indexing_visits INTEGER NOT NULL,
    retrieval_visits INTEGER NOT NULL,
    unique_ips INTEGER NOT NULL,
    unique_pages INTEGER NOT NULL
);
```

## Examples

### Basic Usage

```python
# basic_usage.py
import os
import django
from django.conf import settings

# Configure Django
settings.configure(
    INSTALLED_APPS=['ai_bot_tracker'],
    MIDDLEWARE=['ai_bot_tracker.middleware.AiBotTrackerMiddleware'],
    DATABASES={
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': 'bot_tracker.db',
        }
    },
    AI_BOT_TRACKER={
        'enable_logging': True,
        'skip_non_bots': True,
    }
)

django.setup()

# Your Django app code here
```

### Advanced Usage with PostgreSQL

```python
# advanced_usage.py
settings.configure(
    DATABASES={
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': 'ai_bot_tracker',
            'USER': 'postgres',
            'PASSWORD': 'password',
            'HOST': 'localhost',
            'PORT': '5432',
        }
    },
    AI_BOT_TRACKER={
        'enable_logging': True,
        'async_logging': True,
        'custom_bot_patterns': {
            'CompanyBot': [r'CompanyBot/\d+\.\d+'],
        },
        'ip_ranges': ['192.168.1.0/24'],
        'classification_rules': {
            'retrieval_patterns': [r'/api/v2/'],
        }
    }
)
```

## Environment Variables

```bash
# Database
DB_NAME=ai_bot_tracker
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
USE_POSTGRESQL=true

# Logging
LOG_LEVEL=INFO
LOG_FILE=ai_bot_tracker.log

# Bot Tracker
ENABLE_BOT_LOGGING=true
SKIP_NON_BOTS=true
ASYNC_LOGGING=true
```

## Testing

### Unit Tests

```python
# test_middleware.py
from django.test import TestCase, RequestFactory
from ai_bot_tracker.middleware import AiBotTrackerMiddleware
from ai_bot_tracker.models import BotVisit

class BotTrackerTestCase(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.middleware = AiBotTrackerMiddleware(lambda r: None)
    
    def test_bot_detection(self):
        request = self.factory.get('/', HTTP_USER_AGENT='GPTBot/1.0')
        self.middleware.process_request(request)
        
        self.assertTrue(hasattr(request, 'bot_info'))
        self.assertEqual(request.bot_info['name'], 'GPTBot')
        self.assertTrue(request.bot_info['is_bot'])
```

### Manual Testing

```bash
# Test indexing bot
curl -H "User-Agent: GPTBot/1.0" http://localhost:8000/sitemap.xml

# Test retrieval bot
curl -H "User-Agent: ClaudeBot/1.0" \
     -H "Referer: https://claude.ai" \
     -H "X-Claude-Conversation-Id: 12345" \
     http://localhost:8000/api/data/

# Check statistics
curl http://localhost:8000/admin/stats/
```

## Performance Considerations

- **Async Logging**: Enable `async_logging` for high-traffic sites
- **Database Indexing**: Indexes on timestamp, bot_name, and classification
- **Data Cleanup**: Regular cleanup of old visit records
- **Caching**: Use Django's cache framework for request frequency analysis
- **Connection Pooling**: Use connection pooling for PostgreSQL

## Error Handling

The middleware includes comprehensive error handling:

```python
# Custom error handling
AI_BOT_TRACKER = {
    'error_handling': {
        'log_errors': True,
        'continue_on_error': True,
        'error_log_file': 'bot_tracker_errors.log',
    }
}
```

## Deployment

### Production Settings

```python
# production_settings.py
AI_BOT_TRACKER = {
    'enable_logging': True,
    'async_logging': True,
    'skip_non_bots': True,
    'cleanup_days': 90,  # Keep 90 days of data
}

# Use PostgreSQL in production
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ['DB_NAME'],
        'USER': os.environ['DB_USER'],
        'PASSWORD': os.environ['DB_PASSWORD'],
        'HOST': os.environ['DB_HOST'],
        'PORT': os.environ['DB_PORT'],
        'OPTIONS': {
            'MAX_CONNS': 20,
        }
    }
}
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM python:3.9
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["gunicorn", "myproject.wsgi:application"]
```

## Troubleshooting

### Common Issues

1. **Migration Errors**
   ```bash
   python manage.py migrate --fake-initial
   ```

2. **Database Connection Issues**
   - Check database credentials
   - Ensure database server is running
   - Verify network connectivity

3. **Performance Issues**
   - Enable async logging
   - Add database indexes
   - Clean up old data regularly

4. **Bot Not Detected**
   - Check user-agent patterns
   - Verify IP ranges
   - Enable debug logging

### Debug Mode

```python
AI_BOT_TRACKER = {
    'debug': True,
    'log_level': 'DEBUG',
}
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## Support

For issues and questions:
- Check the troubleshooting section
- Review the examples
- Open an issue on GitHub