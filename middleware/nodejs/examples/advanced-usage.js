const express = require('express');
const { createAiBotTracker } = require('../index');

const app = express();
const port = 3000;

// Advanced configuration with custom rules and PostgreSQL
const tracker = createAiBotTracker({
    // Database configuration - PostgreSQL example
    database: {
        type: 'postgresql', // Switch to 'sqlite' for SQLite
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASS || 'password',
        database: process.env.DB_NAME || 'bot_tracker'
    },
    
    // Logging configuration
    enableLogging: true,
    logLevel: 'debug',
    
    // Bot detection configuration
    customBotPatterns: [
        /CustomAIBot/i,
        /CompanyBot/i,
        /InternalCrawler/i
    ],
    
    // IP ranges for known bot providers (example ranges)
    ipRanges: [
        '66.249.64.0/19',    // Google
        '157.55.39.0/24',    // Bing
        '40.77.167.0/24'     // OpenAI (example)
    ],
    
    // Custom classification rules
    classificationRules: {
        // Custom patterns for indexing detection
        indexingPatterns: [
            /sitemap/i,
            /robots\.txt/i,
            /\.xml$/i
        ],
        
        // Custom patterns for retrieval detection
        retrievalPatterns: [
            /search/i,
            /query/i,
            /api/i
        ],
        
        // Custom header patterns
        retrievalHeaders: [
            'x-openai-assistant-id',
            'x-claude-request-id',
            'x-perplexity-session'
        ]
    },
    
    // Performance options
    skipNonBots: true,
    asyncLogging: false // Synchronous for this example
});

// Initialize tracker before using
tracker.initialize().then(() => {
    console.log('AI Bot Tracker initialized successfully');
}).catch(error => {
    console.error('Failed to initialize tracker:', error);
    process.exit(1);
});

// Use the middleware
app.use(tracker.middleware());

// Middleware to add request timing
app.use((req, res, next) => {
    req.startTime = Date.now();
    next();
});

// Sample routes with different characteristics
app.get('/', (req, res) => {
    res.json({
        message: 'Advanced AI Bot Tracker Demo',
        botInfo: req.botInfo,
        processingTime: Date.now() - req.startTime
    });
});

// API endpoint (likely retrieval)
app.get('/api/search', (req, res) => {
    const query = req.query.q;
    res.json({
        query: query,
        results: [
            { title: 'Result 1', url: '/page1' },
            { title: 'Result 2', url: '/page2' }
        ],
        botInfo: req.botInfo
    });
});

// Content pages (likely indexing)
app.get('/articles/:id', (req, res) => {
    res.json({
        id: req.params.id,
        title: `Article ${req.params.id}`,
        content: 'This is article content that bots might index',
        botInfo: req.botInfo
    });
});

// Sitemap (definitely indexing)
app.get('/sitemap.xml', (req, res) => {
    res.set('Content-Type', 'application/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>http://localhost:${port}/</loc></url>
    <url><loc>http://localhost:${port}/articles/1</loc></url>
    <url><loc>http://localhost:${port}/articles/2</loc></url>
</urlset>`);
});

// Admin dashboard endpoints
app.get('/admin/dashboard', async (req, res) => {
    try {
        const stats = await tracker.getStats({
            timeRange: '24h',
            groupBy: 'bot_name'
        });
        
        res.json({
            title: 'Bot Tracking Dashboard',
            stats: stats,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Detailed statistics with filters
app.get('/admin/stats', async (req, res) => {
    try {
        const options = {
            timeRange: req.query.timeRange || '7d',
            botName: req.query.bot,
            classification: req.query.classification,
            limit: parseInt(req.query.limit) || 100
        };
        
        const stats = await tracker.getStats(options);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Bulk export with options
app.post('/admin/export', async (req, res) => {
    try {
        const { format, timeRange, botName, classification } = req.body;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `bot_visits_${timestamp}.${format}`;
        const filePath = `./exports/${filename}`;
        
        const options = {
            timeRange,
            botName,
            classification
        };
        
        if (format === 'csv') {
            await tracker.exportToCsv(filePath, options);
        } else if (format === 'json') {
            await tracker.exportToJson(filePath, options);
        } else {
            return res.status(400).json({ error: 'Invalid format. Use csv or json.' });
        }
        
        res.json({
            message: 'Export completed',
            filename: filename,
            downloadUrl: `/admin/download/${filename}`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cleanup old data
app.post('/admin/cleanup', async (req, res) => {
    try {
        const daysToKeep = parseInt(req.body.daysToKeep) || 30;
        const result = await tracker.cleanup(daysToKeep);
        res.json({
            message: 'Cleanup completed',
            recordsDeleted: result.deletedCount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        trackerInitialized: tracker.initialized
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Application error:', error);
    res.status(500).json({
        error: 'Internal server error',
        botInfo: req.botInfo
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    try {
        await tracker.close();
        console.log('Tracker closed successfully');
    } catch (error) {
        console.error('Error closing tracker:', error);
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    await tracker.close();
    process.exit(0);
});

app.listen(port, () => {
    console.log(`Advanced Bot Tracker Demo running at http://localhost:${port}`);
    console.log('Available endpoints:');
    console.log('  GET  /                    - Home page');
    console.log('  GET  /api/search?q=term  - Search API (retrieval)');
    console.log('  GET  /articles/:id       - Article pages (indexing)');
    console.log('  GET  /sitemap.xml        - Sitemap (indexing)');
    console.log('  GET  /admin/dashboard    - Admin dashboard');
    console.log('  GET  /admin/stats        - Detailed statistics');
    console.log('  POST /admin/export       - Export data');
    console.log('  POST /admin/cleanup      - Cleanup old data');
    console.log('  GET  /health             - Health check');
    console.log('');
    console.log('Test with different bots:');
    console.log('  curl -H "User-Agent: GPTBot/1.0" http://localhost:3000/');
    console.log('  curl -H "User-Agent: ClaudeBot/1.0" -H "Referer: https://claude.ai" http://localhost:3000/api/search?q=test');
});