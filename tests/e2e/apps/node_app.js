// Plain Node http server with the Node middleware (report-only). Env: PORT, TRACKER_URL, TRACKER_KEY, SITE.
const http = require('http');
const path = require('path');
const { AiBotTracker } = require(path.join(__dirname, '../../../middleware/nodejs'));

const tracker = new AiBotTracker({
  database: false, enableLogging: false,
  report: { endpoint: process.env.TRACKER_URL, key: process.env.TRACKER_KEY, site: process.env.SITE, flushMs: 200 },
});
const mw = tracker.middleware();

http.createServer((req, res) => mw(req, res, () => {
  const p = req.url.split('?')[0];
  res.statusCode = p.endsWith('/missing') ? 404 : 200;
  res.setHeader('content-type', 'text/plain');
  res.end(res.statusCode === 404 ? 'not found' : `ok ${p}`);
})).listen(Number(process.env.PORT), '127.0.0.1');
