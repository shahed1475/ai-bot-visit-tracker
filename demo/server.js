const express = require('express');
const path = require('path');
const fs = require('fs');

// Import our AI Bot Tracker components
const Database = require('../core/database.js');
const BotDetector = require('../core/bot-detector.js');
const RequestClassifier = require('../core/classifier.js');

const app = express();
const port = 3000;

// Initialize components
let db, botDetector, classifier;

async function initializeComponents() {
    try {
        // Initialize database
        db = new Database();
        await db.connect();
        console.log('✓ Database connected');

        // Initialize bot detector with some test patterns
        botDetector = new BotDetector([
            'googlebot',
            'bingbot',
            'slurp',
            'duckduckbot',
            'baiduspider',
            'yandexbot',
            'facebookexternalhit',
            'twitterbot',
            'linkedinbot',
            'whatsapp',
            'telegrambot'
        ]);
        console.log('✓ Bot detector initialized');

        // Initialize request classifier
        classifier = new RequestClassifier();
        console.log('✓ Request classifier initialized');

    } catch (error) {
        console.error('Failed to initialize components:', error);
        process.exit(1);
    }
}

// Middleware to track all requests
app.use(async (req, res, next) => {
    const startTime = Date.now();
    
    // Extract request data
    const requestData = {
        ipAddress: req.ip || req.connection.remoteAddress || '127.0.0.1',
        userAgent: req.get('User-Agent') || '',
        pageUrl: req.protocol + '://' + req.get('host') + req.originalUrl,
        headers: req.headers,
        referer: req.get('Referer') || '',
        requestMethod: req.method
    };

    // Detect if this is a bot
    const botInfo = botDetector.detectBot(requestData.userAgent, requestData.ipAddress);
    
    if (botInfo) {
        // Classify the request
        const classification = classifier.classifyRequest({
            url: requestData.pageUrl,
            headers: requestData.headers,
            userAgent: requestData.userAgent,
            referer: requestData.referer,
            ipAddress: requestData.ipAddress,
            timestamp: new Date()
        });

        // Log the bot visit
        const visitData = {
            ipAddress: requestData.ipAddress,
            botName: botInfo.name,
            pageUrl: requestData.pageUrl,
            headers: requestData.headers,
            classification: classification.type,
            userAgent: requestData.userAgent,
            referer: requestData.referer,
            requestMethod: requestData.requestMethod,
            responseStatus: 200,
            processingTimeMs: Date.now() - startTime
        };

        try {
            const result = await db.logVisit(visitData);
            console.log(`🤖 Bot detected: ${botInfo.name} - ${classification.type} - Visit ID: ${result.visitId}`);
        } catch (error) {
            console.error('Failed to log bot visit:', error);
        }
    }

    next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to get recent bot visits
app.get('/api/visits', async (req, res) => {
    try {
        const visits = await db.all(`
            SELECT * FROM visits 
            ORDER BY timestamp DESC 
            LIMIT 50
        `);
        res.json(visits);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to get bot statistics
app.get('/api/stats', async (req, res) => {
    try {
        const stats = await db.all(`
            SELECT 
                bot_name,
                COUNT(*) as total_visits,
                COUNT(CASE WHEN classification = 'indexing' THEN 1 END) as indexing_visits,
                COUNT(CASE WHEN classification = 'retrieval' THEN 1 END) as retrieval_visits,
                MAX(timestamp) as last_visit
            FROM visits 
            WHERE bot_name IS NOT NULL
            GROUP BY bot_name
            ORDER BY total_visits DESC
        `);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Test endpoint to simulate bot visits
app.get('/api/simulate-bot/:botName', async (req, res) => {
    const { botName } = req.params;
    
    const botUserAgents = {
        'googlebot': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'bingbot': 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
        'facebookbot': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'twitterbot': 'Twitterbot/1.0',
        'linkedinbot': 'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)'
    };

    const userAgent = botUserAgents[botName.toLowerCase()] || `${botName}Bot/1.0`;
    
    // Simulate the request with bot user agent
    req.headers['user-agent'] = userAgent;
    
    res.json({ 
        message: `Simulated ${botName} visit`,
        userAgent: userAgent,
        detected: botDetector.detectBot(userAgent, req.ip)
    });
});

// Main dashboard route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
async function startServer() {
    await initializeComponents();
    
    app.listen(port, () => {
        console.log(`🚀 AI Bot Visit Tracker Demo running at http://localhost:${port}`);
        console.log(`📊 Dashboard: http://localhost:${port}`);
        console.log(`🔗 API Visits: http://localhost:${port}/api/visits`);
        console.log(`📈 API Stats: http://localhost:${port}/api/stats`);
        console.log(`🤖 Simulate GoogleBot: http://localhost:${port}/api/simulate-bot/googlebot`);
    });
}

startServer().catch(console.error);