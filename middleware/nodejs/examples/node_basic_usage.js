const express = require('express');
const path = require('path');
const { createAiBotTracker, createTrackerInstance } = require('../ai-bot-tracker');

const app = express();
const PORT = process.env.PORT || 3001;

// Basic middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Method 1: Simple setup with default configuration
app.use(createAiBotTracker());

// Method 2: Advanced setup with custom configuration (commented out)
/*
const trackerInstance = createTrackerInstance({
    database: {
        type: 'sqlite',
        path: path.join(__dirname, '../../../data/bot_visits.db')
    },
    enableLogging: true,
    logLevel: 'debug',
    addHeaders: true,
    headerPrefix: 'X-Bot-Tracker-',
    customBots: [
        {
            name: 'CustomBot',
            patterns: ['CustomBot/1.0'],
            type: 'indexing'
        }
    ]
});

app.use(trackerInstance.middleware());
*/

// Sample routes for testing
app.get('/', (req, res) => {
    res.json({
        message: 'AI Bot Visit Tracker - Node.js Example',
        timestamp: new Date().toISOString(),
        userAgent: req.get('User-Agent'),
        ip: req.ip
    });
});

app.get('/api/test', (req, res) => {
    res.json({
        endpoint: '/api/test',
        method: req.method,
        headers: req.headers,
        query: req.query
    });
});

app.get('/blog/:slug', (req, res) => {
    res.json({
        type: 'blog-post',
        slug: req.params.slug,
        title: `Sample Blog Post: ${req.params.slug}`,
        content: 'This is a sample blog post that bots might want to index.'
    });
});

app.get('/search', (req, res) => {
    const query = req.query.q || '';
    res.json({
        type: 'search-results',
        query: query,
        results: [
            { title: 'Result 1', url: '/blog/result-1' },
            { title: 'Result 2', url: '/blog/result-2' }
        ]
    });
});

// API endpoint to get bot statistics
app.get('/api/bot-stats', async (req, res) => {
    try {
        // Create a tracker instance to access stats
        const tracker = createTrackerInstance();
        await tracker.initialize();
        
        const stats = await tracker.getStats();
        res.json({
            success: true,
            stats: stats
        });
        
        await tracker.close();
    } catch (error) {
        console.error('Error fetching bot stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch bot statistics'
        });
    }
});

// API endpoint to get recent visits
app.get('/api/recent-visits', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        
        const tracker = createTrackerInstance();
        await tracker.initialize();
        
        const visits = await tracker.getRecentVisits(limit);
        res.json({
            success: true,
            visits: visits
        });
        
        await tracker.close();
    } catch (error) {
        console.error('Error fetching recent visits:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch recent visits'
        });
    }
});

// Simulate bot requests for testing
app.get('/simulate-bot/:botName', (req, res) => {
    const botName = req.params.botName.toLowerCase();
    
    const botUserAgents = {
        'googlebot': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'bingbot': 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
        'gptbot': 'GPTBot/1.0 (+https://openai.com/gptbot)',
        'claudebot': 'ClaudeBot/1.0 (+https://www.anthropic.com/claudebot)',
        'perplexitybot': 'PerplexityBot/1.0 (+https://www.perplexity.ai/bot)'
    };
    
    const userAgent = botUserAgents[botName];
    if (!userAgent) {
        return res.status(400).json({
            error: 'Unknown bot name',
            availableBots: Object.keys(botUserAgents)
        });
    }
    
    // Override the user agent for this request
    req.headers['user-agent'] = userAgent;
    
    res.json({
        message: `Simulated ${botName} request`,
        userAgent: userAgent,
        timestamp: new Date().toISOString(),
        note: 'This request should be logged as a bot visit'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        path: req.path
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 AI Bot Tracker Node.js Example running on http://localhost:${PORT}`);
    console.log(`📊 Bot Stats: http://localhost:${PORT}/api/bot-stats`);
    console.log(`📋 Recent Visits: http://localhost:${PORT}/api/recent-visits`);
    console.log(`🤖 Simulate GoogleBot: http://localhost:${PORT}/simulate-bot/googlebot`);
    console.log(`🤖 Simulate GPTBot: http://localhost:${PORT}/simulate-bot/gptbot`);
    console.log(`🤖 Simulate ClaudeBot: http://localhost:${PORT}/simulate-bot/claudebot`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    process.exit(0);
});

module.exports = app;