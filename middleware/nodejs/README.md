# AI Bot Tracker - Node.js Express Middleware

A comprehensive middleware solution for detecting, logging, and analyzing AI bot visits to your Express.js applications.

## Features

- 🤖 **Bot Detection**: Automatically detects AI bots using user-agent patterns and IP ranges
- 📊 **Request Classification**: Classifies requests as "indexing" or "retrieval" using intelligent heuristics
- 💾 **Database Support**: SQLite for development, PostgreSQL for production
- 📈 **Analytics**: Built-in statistics and reporting
- 📤 **Data Export**: Export data to CSV or JSON formats
- ⚡ **Performance**: Async logging and configurable bot filtering
- 🔧 **Flexible**: Highly configurable with custom rules and patterns

## Quick Start

### Installation

```bash
npm install ai-bot-tracker-nodejs
```

### Basic Usage

```javascript
const express = require('express');
const { quickSetup } = require('ai-bot-tracker-nodejs');

const app = express();

// Quick setup with default configuration
const tracker = quickSetup(app);

app.get('/', (req, res) => {
    res.json({
        message: 'Hello World',
        botDetected: req.botInfo?.isBot || false,
        botName: req.botInfo?.botName || 'Not a bot'
    });
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
```

## Configuration Options

### Database Configuration

#### SQLite (Default)
```javascript
const tracker = createAiBotTracker({
    database: {
        type: 'sqlite',
        path: './bot_visits.db'
    }
});
```

#### PostgreSQL
```javascript
const tracker = createAiBotTracker({
    database: {
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'password',
        database: 'bot_tracker'
    }
});
```

### Advanced Configuration

```javascript
const { createAiBotTracker } = require('ai-bot-tracker-nodejs');

const tracker = createAiBotTracker({
    // Database settings
    database: {
        type: 'sqlite',
        path: './bot_visits.db'
    },
    
    // Logging settings
    enableLogging: true,
    logLevel: 'info',
    
    // Bot detection settings
    customBotPatterns: [
        /CustomBot/i,
        /MyAIBot/i
    ],
    ipRanges: [
        '66.249.64.0/19',  // Google
        '40.77.167.0/24'   // OpenAI (example)
    ],
    
    // Classification rules
    classificationRules: {
        indexingPatterns: [/sitemap/i, /robots\.txt/i],
        retrievalPatterns: [/search/i, /api/i],
        retrievalHeaders: ['x-openai-assistant-id']
    },
    
    // Performance settings
    skipNonBots: true,
    asyncLogging: true
});

app.use(tracker.middleware());
```

## API Reference

### AiBotTracker Class

#### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `database` | Object | SQLite config | Database configuration |
| `enableLogging` | Boolean | `true` | Enable console logging |
| `logLevel` | String | `'info'` | Log level (debug, info, warn, error) |
| `customBotPatterns` | Array | `[]` | Custom regex patterns for bot detection |
| `ipRanges` | Array | `[]` | IP ranges for bot detection |
| `classificationRules` | Object | `{}` | Custom classification rules |
| `skipNonBots` | Boolean | `true` | Skip processing non-bot requests |
| `asyncLogging` | Boolean | `true` | Enable asynchronous logging |

#### Methods

##### `initialize()`
Initialize the tracker and database connection.

```javascript
await tracker.initialize();
```

##### `middleware()`
Returns Express middleware function.

```javascript
app.use(tracker.middleware());
```

##### `getStats(options)`
Get statistics about bot visits.

```javascript
const stats = await tracker.getStats({
    timeRange: '24h',     // '1h', '24h', '7d', '30d'
    botName: 'GPTBot',    // Filter by specific bot
    classification: 'indexing', // 'indexing' or 'retrieval'
    groupBy: 'bot_name',  // Group results by field
    limit: 100            // Limit number of results
});
```

##### `exportToCsv(filePath, options)`
Export data to CSV file.

```javascript
await tracker.exportToCsv('./exports/bot_visits.csv', {
    timeRange: '7d',
    botName: 'GPTBot'
});
```

##### `exportToJson(filePath, options)`
Export data to JSON file.

```javascript
await tracker.exportToJson('./exports/bot_visits.json', {
    timeRange: '7d'
});
```

##### `cleanup(daysToKeep)`
Clean up old log entries.

```javascript
const result = await tracker.cleanup(30); // Keep last 30 days
console.log(`Deleted ${result.deletedCount} old records`);
```

##### `close()`
Close database connections.

```javascript
await tracker.close();
```

## Request Object Enhancement

The middleware adds a `botInfo` object to each request:

```javascript
app.get('/api/data', (req, res) => {
    console.log(req.botInfo);
    // {
    //   isBot: true,
    //   botName: 'GPTBot',
    //   confidence: 0.95,
    //   classification: 'retrieval',
    //   classificationReason: 'Has referer header'
    // }
});
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
```javascript
const express = require('express');
const { quickSetup } = require('ai-bot-tracker-nodejs');

const app = express();
const tracker = quickSetup(app);

app.get('/', (req, res) => {
    if (req.botInfo?.isBot) {
        console.log(`Bot detected: ${req.botInfo.botName}`);
    }
    res.send('Hello World');
});
```

### Statistics Dashboard
```javascript
app.get('/admin/stats', async (req, res) => {
    const stats = await tracker.getStats({
        timeRange: '24h',
        groupBy: 'bot_name'
    });
    res.json(stats);
});
```

### Data Export
```javascript
app.get('/admin/export', async (req, res) => {
    const filePath = './exports/bot_visits.csv';
    await tracker.exportToCsv(filePath);
    res.download(filePath);
});
```

## Environment Variables

```bash
# Database configuration (for PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=password
DB_NAME=bot_tracker

# Logging
LOG_LEVEL=info
ENABLE_LOGGING=true

# Performance
SKIP_NON_BOTS=true
ASYNC_LOGGING=true
```

## Testing

Run the example server:

```bash
cd middleware/nodejs
npm install
npm run example
```

Test with different user agents:

```bash
# Test with GPTBot
curl -H "User-Agent: GPTBot/1.0" http://localhost:3000/

# Test with ClaudeBot
curl -H "User-Agent: ClaudeBot/1.0" -H "Referer: https://claude.ai" http://localhost:3000/

# Test with regular browser
curl -H "User-Agent: Mozilla/5.0" http://localhost:3000/
```

## Performance Considerations

- **Async Logging**: Enable `asyncLogging: true` for high-traffic sites
- **Skip Non-Bots**: Enable `skipNonBots: true` to avoid processing regular users
- **Database**: Use PostgreSQL for production environments
- **Cleanup**: Regularly clean up old logs using the `cleanup()` method

## Error Handling

The middleware is designed to never block requests, even if errors occur:

```javascript
app.use((error, req, res, next) => {
    console.error('Bot tracker error:', error);
    // Request continues normally
    next();
});
```

## License

MIT License - see LICENSE file for details.