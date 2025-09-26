# AI Bot Tracker - Python Flask Middleware

A comprehensive middleware solution for detecting, logging, and analyzing AI bot visits to your Flask applications.

## Features

- 🤖 **Bot Detection**: Automatically detects AI bots using user-agent patterns and IP ranges
- 📊 **Request Classification**: Classifies requests as "indexing" or "retrieval" using intelligent heuristics
- 💾 **Database Support**: SQLite for development, PostgreSQL for production
- 📈 **Analytics**: Built-in statistics and reporting
- 📤 **Data Export**: Export data to CSV format
- ⚡ **Performance**: Async logging and configurable bot filtering
- 🔧 **Flexible**: Highly configurable with custom rules and patterns

## Quick Start

### Installation

```bash
pip install -r requirements.txt
```

### Basic Usage

```python
from flask import Flask, jsonify, g
from ai_bot_tracker import init_bot_tracker

app = Flask(__name__)

# Initialize bot tracker with default configuration
tracker = init_bot_tracker(app,
    database={
        'type': 'sqlite',
        'path': './bot_visits.db'
    },
    enable_logging=True,
    skip_non_bots=True,
    async_logging=True
)

@app.route('/')
def home():
    bot_info = getattr(g, 'bot_info', {})
    return jsonify({
        'message': 'Hello World',
        'bot_detected': bot_info.get('is_bot', False),
        'bot_name': bot_info.get('bot_name', 'Not a bot')
    })

if __name__ == '__main__':
    app.run(debug=True)
```

## Configuration Options

### Database Configuration

#### SQLite (Default)
```python
tracker = init_bot_tracker(app,
    database={
        'type': 'sqlite',
        'path': './bot_visits.db'
    }
)
```

#### PostgreSQL
```python
tracker = init_bot_tracker(app,
    database={
        'type': 'postgresql',
        'host': 'localhost',
        'port': 5432,
        'username': 'postgres',
        'password': 'password',
        'database': 'bot_tracker'
    }
)
```

### Advanced Configuration

```python
from ai_bot_tracker import init_bot_tracker

tracker = init_bot_tracker(app,
    # Database settings
    database={
        'type': 'sqlite',
        'path': './bot_visits.db'
    },
    
    # Logging settings
    enable_logging=True,
    
    # Bot detection settings
    custom_bot_patterns={
        'CustomBot': [r'CustomBot/\d+\.\d+', r'MyAIBot'],
        'CompanyBot': [r'CompanyBot']
    },
    ip_ranges=[
        '66.249.64.0/19',  # Google
        '40.77.167.0/24'   # OpenAI (example)
    ],
    
    # Classification rules
    classification_rules={
        'indexing_patterns': [r'/sitemap', r'/robots\.txt'],
        'retrieval_patterns': [r'/search', r'/api/'],
        'retrieval_headers': ['x-openai-assistant-id']
    },
    
    # Performance settings
    skip_non_bots=True,
    async_logging=True
)
```

## API Reference

### AiBotTracker Class

#### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `database` | Dict | SQLite config | Database configuration |
| `enable_logging` | Bool | `True` | Enable console logging |
| `skip_non_bots` | Bool | `True` | Skip processing non-bot requests |
| `async_logging` | Bool | `True` | Enable asynchronous logging |
| `custom_bot_patterns` | Dict | `{}` | Custom regex patterns for bot detection |
| `ip_ranges` | List | `[]` | IP ranges for bot detection |
| `classification_rules` | Dict | `{}` | Custom classification rules |

#### Methods

##### `get_stats(**options)`
Get statistics about bot visits.

```python
stats = tracker.get_stats(
    time_range='24h',     # '1h', '24h', '7d', '30d'
    bot_name='GPTBot',    # Filter by specific bot
    classification='indexing'  # 'indexing' or 'retrieval'
)
```

##### `export_to_csv(file_path, **options)`
Export data to CSV file.

```python
tracker.export_to_csv('./exports/bot_visits.csv',
    time_range='7d',
    bot_name='GPTBot'
)
```

##### `close()`
Close database connections.

```python
tracker.close()
```

## Flask Integration

The middleware automatically integrates with Flask using `before_request` and `after_request` hooks:

```python
from flask import g

@app.route('/api/data')
def api_data():
    # Access bot information in your routes
    bot_info = getattr(g, 'bot_info', {})
    classification_info = getattr(g, 'classification_info', {})
    
    return jsonify({
        'data': 'Your API data',
        'bot_detected': bot_info.get('is_bot', False),
        'classification': classification_info.get('classification')
    })
```

## Bot Information Structure

The middleware adds bot information to Flask's `g` object:

```python
# g.bot_info structure
{
    'is_bot': True,
    'bot_name': 'GPTBot',
    'confidence': 0.95,
    'detection_method': 'user_agent'
}

# g.classification_info structure
{
    'classification': 'retrieval',
    'confidence': 0.8,
    'indexing_score': 0.2,
    'retrieval_score': 0.8,
    'reasons': ['Has referer header', 'URL matches retrieval pattern']
}
```

## Supported AI Bots

The middleware automatically detects these AI bots:

- **OpenAI**: GPTBot, ChatGPT-User
- **Anthropic**: ClaudeBot, Claude-Web
- **Google**: Google-Extended, Bard
- **Microsoft**: BingBot, EdgeBot
- **Perplexity**: PerplexityBot
- **Meta**: FacebookBot, Meta-ExternalAgent
- **And many more...**

## Classification Logic

### Indexing Requests
Classified as indexing when:
- Sequential/frequent requests from same IP
- No referer header
- Accessing sitemap.xml, robots.txt
- Following pagination patterns

### Retrieval Requests
Classified as retrieval when:
- Has referer header (especially from AI platforms)
- Contains special headers (x-openai-*, x-claude-*, etc.)
- Sporadic request patterns
- Accessing search/API endpoints

## Database Schema

### visits Table
```sql
CREATE TABLE visits (
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
```

## Examples

### Basic Bot Detection
```python
from flask import Flask, g
from ai_bot_tracker import init_bot_tracker

app = Flask(__name__)
tracker = init_bot_tracker(app)

@app.route('/')
def home():
    bot_info = getattr(g, 'bot_info', {})
    if bot_info.get('is_bot'):
        print(f"Bot detected: {bot_info.get('bot_name')}")
    return 'Hello World'
```

### Statistics Endpoint
```python
@app.route('/admin/stats')
def admin_stats():
    stats = tracker.get_stats(time_range='24h')
    return jsonify(stats)
```

### Data Export
```python
@app.route('/admin/export')
def export_data():
    file_path = './exports/bot_visits.csv'
    tracker.export_to_csv(file_path)
    return jsonify({'message': 'Export completed', 'file': file_path})
```

### Custom Bot Detection
```python
tracker = init_bot_tracker(app,
    custom_bot_patterns={
        'MyCustomBot': [r'MyBot/\d+\.\d+', r'CustomCrawler'],
        'CompanyBot': [r'CompanyBot']
    }
)
```

## Environment Variables

```bash
# Database configuration (for PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=password
DB_NAME=bot_tracker

# Flask configuration
FLASK_ENV=development
FLASK_DEBUG=True
```

## Running Examples

### Basic Example
```bash
cd middleware/python/flask
pip install -r requirements.txt
python examples/basic_usage.py
```

### Advanced Example
```bash
cd middleware/python/flask
pip install -r requirements.txt
python examples/advanced_usage.py
```

## Testing

Test with different user agents:

```bash
# Test with GPTBot
curl -H "User-Agent: GPTBot/1.0" http://localhost:5000/

# Test with ClaudeBot
curl -H "User-Agent: ClaudeBot/1.0" -H "Referer: https://claude.ai" http://localhost:5000/

# Test with regular browser
curl -H "User-Agent: Mozilla/5.0" http://localhost:5000/
```

## Performance Considerations

- **Async Logging**: Enable `async_logging=True` for high-traffic sites
- **Skip Non-Bots**: Enable `skip_non_bots=True` to avoid processing regular users
- **Database**: Use PostgreSQL for production environments
- **Threading**: The async logger runs in a separate daemon thread

## Error Handling

The middleware is designed to never block requests, even if errors occur:

```python
@app.errorhandler(500)
def handle_error(error):
    # Bot tracking errors won't prevent normal request processing
    return jsonify({'error': 'Internal server error'}), 500
```

## Deployment

### Production Checklist

1. **Database**: Switch to PostgreSQL for production
2. **Environment Variables**: Set database credentials via environment variables
3. **Logging**: Configure appropriate log levels
4. **Monitoring**: Set up health check endpoints
5. **Cleanup**: Implement regular cleanup of old logs

### Docker Example

```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 5000

CMD ["python", "app.py"]
```

### Environment Configuration

```python
import os
from ai_bot_tracker import init_bot_tracker

# Production configuration
tracker = init_bot_tracker(app,
    database={
        'type': 'postgresql',
        'host': os.getenv('DB_HOST'),
        'port': int(os.getenv('DB_PORT', 5432)),
        'username': os.getenv('DB_USER'),
        'password': os.getenv('DB_PASS'),
        'database': os.getenv('DB_NAME')
    },
    enable_logging=os.getenv('ENABLE_LOGGING', 'true').lower() == 'true',
    skip_non_bots=os.getenv('SKIP_NON_BOTS', 'true').lower() == 'true',
    async_logging=os.getenv('ASYNC_LOGGING', 'true').lower() == 'true'
)
```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**: Check database credentials and connectivity
2. **Import Errors**: Ensure all dependencies are installed via `pip install -r requirements.txt`
3. **Permission Errors**: Check file permissions for SQLite database files
4. **Threading Issues**: Disable async logging if experiencing thread-related problems

### Debug Mode

Enable debug logging:

```python
tracker = init_bot_tracker(app,
    enable_logging=True,
    # Add debug configuration
)
```

## License

MIT License - see LICENSE file for details.