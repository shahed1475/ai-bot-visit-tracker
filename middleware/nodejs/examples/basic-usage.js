const express = require('express');
const { createAiBotTracker, quickSetup } = require('../index');

const app = express();
const port = 3000;

// Method 1: Quick setup (recommended for simple use cases)
console.log('Setting up AI Bot Tracker with quick setup...');
const tracker = quickSetup(app, {
    database: {
        type: 'sqlite',
        path: './bot_visits.db'
    },
    enableLogging: true,
    skipNonBots: true,
    asyncLogging: true
});

// Method 2: Manual setup (for more control)
/*
const tracker = createAiBotTracker({
    database: {
        type: 'sqlite',
        path: './bot_visits.db'
    },
    enableLogging: true,
    skipNonBots: true,
    asyncLogging: true,
    customBotPatterns: [
        /CustomBot/i,
        /MyAIBot/i
    ]
});

app.use(tracker.middleware());
*/

// Sample routes
app.get('/', (req, res) => {
    res.json({
        message: 'AI Bot Tracker Demo',
        botDetected: req.botInfo?.isBot || false,
        botName: req.botInfo?.botName || 'Not a bot',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/data', (req, res) => {
    res.json({
        data: 'This is some API data',
        botInfo: req.botInfo
    });
});

app.get('/blog/post-1', (req, res) => {
    res.json({
        title: 'Sample Blog Post',
        content: 'This is a sample blog post that bots might index',
        botInfo: req.botInfo
    });
});

// Statistics endpoint
app.get('/admin/bot-stats', async (req, res) => {
    try {
        const stats = await tracker.getStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Export endpoints
app.get('/admin/export/csv', async (req, res) => {
    try {
        const filePath = './exports/bot_visits.csv';
        await tracker.exportToCsv(filePath);
        res.download(filePath);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/admin/export/json', async (req, res) => {
    try {
        const filePath = './exports/bot_visits.json';
        await tracker.exportToJson(filePath);
        res.download(filePath);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await tracker.close();
    process.exit(0);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log('Try accessing with different user agents to test bot detection:');
    console.log('curl -H "User-Agent: GPTBot/1.0" http://localhost:3000/');
    console.log('curl -H "User-Agent: ClaudeBot/1.0" http://localhost:3000/');
    console.log('curl -H "User-Agent: Mozilla/5.0" http://localhost:3000/');
});