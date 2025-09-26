# AI Bot Tracker - PHP Middleware

A comprehensive PHP middleware for tracking and analyzing AI bot visits to your web applications. This middleware provides real-time detection, classification, and analytics for AI bots like GPT, Claude, Bard, and many others.

## Features

- **Real-time Bot Detection**: Identify AI bots using user-agent patterns and IP ranges
- **Request Classification**: Categorize bot requests as indexing or retrieval operations
- **Multiple Database Support**: SQLite, MySQL, PostgreSQL
- **Comprehensive Analytics**: Detailed statistics and reporting
- **Data Export**: Export data in CSV and JSON formats
- **Performance Optimized**: Efficient database operations and optional caching
- **Framework Agnostic**: Works with any PHP application or framework
- **Configurable**: Extensive configuration options for customization
- **Rate Limiting**: Built-in rate limiting for bot requests
- **Async Logging**: Optional asynchronous request logging

## Quick Start

### Installation

```bash
composer require ai-bot-tracker/php-middleware
```

### Basic Usage

```php
<?php
require_once 'vendor/autoload.php';

use AiBotTracker\AiBotTracker;

// Initialize with default configuration
$tracker = new AiBotTracker();

// Process current request
$botInfo = $tracker->processRequest();

if ($botInfo) {
    echo "Bot detected: " . $botInfo['name'];
    echo "Classification: " . $botInfo['classification']['type'];
    
    // Handle bot-specific logic
    if ($botInfo['classification']['type'] === 'indexing') {
        // Serve full content for indexing bots
        serveFullContent();
    } else {
        // Handle retrieval bots with rate limiting
        handleRetrievalBot($botInfo);
    }
}
?>
```

### Framework Integration

#### Laravel Middleware

```php
<?php
namespace App\Http\Middleware;

use Closure;
use AiBotTracker\AiBotTracker;

class BotTrackingMiddleware
{
    private $tracker;
    
    public function __construct()
    {
        $this->tracker = new AiBotTracker([
            'database' => [
                'type' => 'mysql',
                'host' => env('DB_HOST'),
                'database' => env('DB_DATABASE'),
                'username' => env('DB_USERNAME'),
                'password' => env('DB_PASSWORD'),
            ]
        ]);
    }
    
    public function handle($request, Closure $next)
    {
        $botInfo = $this->tracker->processRequest([
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'url' => $request->fullUrl(),
            'referer' => $request->header('referer'),
            'method' => $request->method(),
            'headers' => $request->headers->all()
        ]);
        
        if ($botInfo) {
            $request->attributes->set('bot_info', $botInfo);
        }
        
        return $next($request);
    }
}
```

#### Symfony Middleware

```php
<?php
namespace App\Middleware;

use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use AiBotTracker\AiBotTracker;

class BotTrackingMiddleware
{
    private $tracker;
    
    public function __construct(AiBotTracker $tracker)
    {
        $this->tracker = $tracker;
    }
    
    public function __invoke(Request $request, callable $next): Response
    {
        $botInfo = $this->tracker->processRequest([
            'ip_address' => $request->getClientIp(),
            'user_agent' => $request->headers->get('User-Agent'),
            'url' => $request->getUri(),
            'referer' => $request->headers->get('Referer'),
            'method' => $request->getMethod(),
            'headers' => $request->headers->all()
        ]);
        
        if ($botInfo) {
            $request->attributes->set('bot_info', $botInfo);
        }
        
        return $next($request);
    }
}
```

## Configuration

### Database Configuration

```php
$config = [
    'database' => [
        'type' => 'mysql', // sqlite, mysql, postgresql
        'host' => 'localhost',
        'port' => 3306,
        'database' => 'ai_bot_tracker',
        'username' => 'username',
        'password' => 'password',
        'charset' => 'utf8mb4',
        'options' => [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    ]
];
```

### Bot Detection Configuration

```php
$config = [
    'bot_detection' => [
        'custom_patterns' => [
            'MyBot' => '/MyBot\/[\d\.]+/i',
            'CustomCrawler' => '/CustomCrawler/i'
        ],
        'custom_ip_ranges' => [
            '192.168.1.0/24',
            '10.0.0.0/8'
        ],
        'detection_methods' => ['user_agent', 'ip_range']
    ]
];
```

### Classification Configuration

```php
$config = [
    'classification' => [
        'indexing_patterns' => [
            'urls' => ['/\/sitemap\.xml$/i', '/\/robots\.txt$/i'],
            'headers' => ['Accept' => '/application\/xml/i'],
            'user_agents' => ['/crawler|spider/i']
        ],
        'retrieval_patterns' => [
            'urls' => ['/\/api\/content/i', '/\/download/i'],
            'headers' => ['Accept' => '/application\/json/i']
        ],
        'custom_rules' => [
            [
                'name' => 'High Frequency',
                'condition' => function($data) {
                    return $data['request_count'] > 10;
                },
                'classification' => 'retrieval',
                'confidence' => 0.8
            ]
        ]
    ]
];
```

### Logging Configuration

```php
$config = [
    'logging' => [
        'enabled' => true,
        'async' => false,
        'log_headers' => true,
        'log_response_time' => true,
        'log_file' => '/var/log/bot_tracker.log'
    ]
];
```

## API Reference

### AiBotTracker Class

#### Constructor

```php
public function __construct(array $config = [])
```

#### Methods

##### processRequest()
```php
public function processRequest(array $requestData = []): ?array
```
Process incoming request and detect bots.

**Parameters:**
- `$requestData` (array): Request data (optional, auto-detected if not provided)

**Returns:**
- `array|null`: Bot information if detected, null otherwise

##### getStats()
```php
public function getStats(string $timeRange = '24h', ?string $botName = null): array
```
Get visit statistics.

**Parameters:**
- `$timeRange` (string): Time range ('24h', '7d', '30d', 'all')
- `$botName` (string|null): Filter by bot name

**Returns:**
- `array`: Statistics data

##### exportToCsv()
```php
public function exportToCsv(string $filePath, string $timeRange = '24h', ?string $botName = null, ?string $classification = null): int
```
Export visits to CSV file.

##### exportToJson()
```php
public function exportToJson(string $filePath, string $timeRange = '24h', ?string $botName = null, ?string $classification = null): int
```
Export visits to JSON file.

##### cleanup()
```php
public function cleanup(?int $daysToKeep = null): int
```
Clean up old visit records.

### Bot Information Structure

When a bot is detected, the following information is returned:

```php
[
    'name' => 'GPTBot',
    'detection_method' => 'user_agent',
    'classification' => [
        'type' => 'indexing',        // or 'retrieval'
        'confidence' => 0.85,
        'factors' => [
            'url_pattern' => true,
            'user_agent' => true,
            'headers' => false
        ]
    ],
    'visit_data' => [
        'timestamp' => '2024-01-15 10:30:00',
        'ip_address' => '192.168.1.100',
        'user_agent' => 'GPTBot/1.0',
        'url' => 'https://example.com/page',
        'referer' => 'https://google.com',
        'method' => 'GET',
        'headers' => [...],
        'response_time' => 0.125
    ]
]
```

## Supported AI Bots

The middleware automatically detects the following AI bots:

### OpenAI Bots
- **GPTBot**: OpenAI's web crawler
- **ChatGPT-User**: ChatGPT user requests

### Anthropic Bots
- **Claude-Web**: Claude's web crawler
- **ClaudeBot**: Anthropic's bot

### Google Bots
- **Google-Extended**: Google's AI training crawler
- **Bard**: Google Bard requests

### Microsoft Bots
- **BingBot**: Microsoft Bing crawler
- **MSNBot**: Microsoft network crawler

### Other AI Bots
- **FacebookBot**: Meta's crawler
- **TwitterBot**: Twitter's crawler
- **LinkedInBot**: LinkedIn's crawler
- **PerplexityBot**: Perplexity AI crawler
- **YouBot**: You.com crawler

## Classification Logic

The middleware classifies bot requests into two categories:

### Indexing Requests
Bots that are crawling to index content:
- Accessing sitemap.xml, robots.txt
- Following links systematically
- Requesting RSS/XML feeds
- Search engine crawling patterns

### Retrieval Requests
Bots that are retrieving specific content:
- API endpoint access
- Direct content downloads
- High-frequency requests
- Specific data extraction patterns

## Database Schema

### visits Table
```sql
CREATE TABLE visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45) NOT NULL,
    bot_name VARCHAR(100) NOT NULL,
    page_url TEXT NOT NULL,
    headers TEXT,
    classification VARCHAR(20) NOT NULL DEFAULT 'indexing',
    user_agent TEXT,
    referer TEXT,
    request_method VARCHAR(10) NOT NULL DEFAULT 'GET',
    response_status INTEGER,
    response_time REAL,
    confidence REAL DEFAULT 0.5,
    detection_method VARCHAR(20),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### bot_stats Table
```sql
CREATE TABLE bot_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    bot_name VARCHAR(100) NOT NULL,
    total_visits INTEGER NOT NULL DEFAULT 0,
    indexing_visits INTEGER NOT NULL DEFAULT 0,
    retrieval_visits INTEGER NOT NULL DEFAULT 0,
    unique_ips INTEGER NOT NULL DEFAULT 0,
    unique_pages INTEGER NOT NULL DEFAULT 0,
    avg_response_time REAL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, bot_name)
);
```

### config Table
```sql
CREATE TABLE config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_name VARCHAR(100) NOT NULL UNIQUE,
    key_value TEXT,
    description TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Examples

### Basic Example
See `examples/basic_usage.php` for a simple implementation.

### Advanced Example
See `examples/advanced_usage.php` for advanced configuration and framework integration.

### Custom Bot Detection
```php
$tracker = new AiBotTracker([
    'bot_detection' => [
        'custom_patterns' => [
            'MyCustomBot' => '/MyBot\/[\d\.]+/i'
        ]
    ]
]);
```

### Rate Limiting
```php
$tracker = new AiBotTracker([
    'rate_limiting' => [
        'enabled' => true,
        'max_requests_per_minute' => 60,
        'max_requests_per_hour' => 1000
    ]
]);
```

## Environment Variables

You can configure the middleware using environment variables:

```bash
# Database configuration
AI_BOT_TRACKER_DB_TYPE=mysql
AI_BOT_TRACKER_DB_HOST=localhost
AI_BOT_TRACKER_DB_NAME=ai_bot_tracker
AI_BOT_TRACKER_DB_USER=username
AI_BOT_TRACKER_DB_PASS=password

# Feature flags
AI_BOT_TRACKER_ENABLED=true
AI_BOT_TRACKER_LOG_HEADERS=true
AI_BOT_TRACKER_ASYNC_LOGGING=false

# Performance
AI_BOT_TRACKER_CLEANUP_INTERVAL=3600
AI_BOT_TRACKER_DAYS_TO_KEEP=30
```

## Testing

### Running Tests
```bash
composer test
```

### Manual Testing
```bash
# Test with different user agents
curl -H "User-Agent: GPTBot/1.0" http://localhost/your-app
curl -H "User-Agent: Claude-Web/1.0" http://localhost/your-app
curl -H "User-Agent: Mozilla/5.0 (compatible; Bard)" http://localhost/your-app
```

## Performance Considerations

### Database Optimization
- Use appropriate indexes for query performance
- Consider partitioning for large datasets
- Regular cleanup of old data

### Caching
- Enable caching for frequently accessed data
- Use Redis or Memcached for distributed caching

### Async Processing
- Enable async logging for high-traffic sites
- Use queue systems for heavy processing

## Error Handling

The middleware includes comprehensive error handling:

```php
try {
    $botInfo = $tracker->processRequest();
} catch (PDOException $e) {
    // Database error
    error_log("Database error: " . $e->getMessage());
} catch (Exception $e) {
    // General error
    error_log("Tracker error: " . $e->getMessage());
}
```

## Deployment

### Production Checklist
- [ ] Configure appropriate database settings
- [ ] Set up log rotation
- [ ] Configure cleanup schedules
- [ ] Monitor performance metrics
- [ ] Set up alerting for errors

### Docker Deployment
```dockerfile
FROM php:8.1-apache

# Install PDO extensions
RUN docker-php-ext-install pdo pdo_mysql pdo_pgsql

# Copy application
COPY . /var/www/html/

# Install dependencies
RUN composer install --no-dev --optimize-autoloader
```

## Troubleshooting

### Common Issues

#### Database Connection Errors
- Verify database credentials
- Check network connectivity
- Ensure database server is running

#### Bot Not Detected
- Check user-agent patterns
- Verify IP range configurations
- Enable debug logging

#### Performance Issues
- Enable caching
- Optimize database queries
- Consider async processing

### Debug Mode
```php
$tracker = new AiBotTracker([
    'logging' => [
        'log_level' => 'debug',
        'log_file' => '/var/log/bot_tracker_debug.log'
    ]
]);
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Support

For support and questions:
- GitHub Issues: [Create an issue](https://github.com/ai-bot-tracker/php-middleware/issues)
- Documentation: [Full documentation](https://docs.ai-bot-tracker.com)
- Email: support@ai-bot-tracker.com

## Changelog

### v1.0.0
- Initial release
- Basic bot detection and classification
- Database support for SQLite, MySQL, PostgreSQL
- Export functionality (CSV, JSON)
- Framework integration examples