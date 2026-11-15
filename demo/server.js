const express = require('express');
const path = require('path');
const fs = require('fs');

// Use the real middleware: it detects bots, classifies by declared purpose and logs to SQLite.
const { AiBotTracker } = require('../middleware/nodejs');

const app = express();
const port = process.env.PORT || 3000;
const tracker = new AiBotTracker({ database: { type: 'sqlite', path: path.join(__dirname, 'data', 'demo.db') } });
app.use(tracker.middleware());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/visits', async (_req, res) => {
    try { res.json(await tracker.getRecentVisits(50)); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/stats', tracker.statsHandler());

app.listen(port, () => {
    console.log(`AI Bot Tracker demo: http://localhost:${port}`);
    console.log(`Try: curl -A "GPTBot/1.4" http://localhost:${port}/ && curl http://localhost:${port}/api/stats`);
});
