// Run: node middleware/nodejs/examples/express-app.js   (needs `npm install express`)
const express = require('express');
const { AiBotTracker } = require('..');

const app = express();
const tracker = new AiBotTracker({
    database: { type: 'sqlite', path: './data/bot_visits.db' },
    // Optional: also send every bot visit to your Cloudflare tracker dashboard.
    // report: { endpoint: 'https://ai-bot-tracker.<you>.workers.dev', key: process.env.INGEST_KEY, site: 'example.com' },
});

app.use(tracker.middleware());
app.get('/', (_req, res) => res.send('Hello'));
app.get('/ai-bot-tracker/stats', tracker.statsHandler()); // add your own auth before exposing this

app.listen(3000, () => console.log('http://localhost:3000'));
