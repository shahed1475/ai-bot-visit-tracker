# Node.js (Express) middleware

```js
const { AiBotTracker } = require('./middleware/nodejs');

const tracker = new AiBotTracker({
  database: { type: 'sqlite', path: './data/bot_visits.db' },   // false = no local storage
  report: { endpoint: 'https://your-worker.workers.dev', key: process.env.TRACKER_KEY, site: 'example.com' }, // optional: send visits to your tracker
});
app.use(tracker.middleware());
app.get('/ai-bot-tracker/stats', yourAuth, tracker.statsHandler());
```

Copy `middleware/nodejs`, `core` and `signatures` together (they use relative paths). Needs Node 18+ and `sqlite3` when local storage is on.

Options: `skipNonBots` (true), `asyncLogging` (true), `addHeaders` (false), `customBotPatterns` (`[{id,name,pattern,kind,purpose}]`), `ipRanges` (`{botId:[cidr]}` for verification; `BotDetector#refreshIpRanges()` downloads the vendor lists), `trustCloudflareHeaders` (false: only enable behind Cloudflare). Set Express `trust proxy` if you run behind your own proxy.

`req.botInfo` holds `{isBot, botId, botName, operator, kind, purpose, verified}` for bot requests. Stored: bot, classification (`training|indexing|retrieval|unknown`), status, time, headers without cookies or authorization, URL without query string. Methods: `getStats()`, `getRecentVisits(n)`, `exportToJson(filters)`, `cleanup(days)`, `close()`.

Reporting is fire-and-forget: visits are batched and sent after the response, with a 2 second timeout, and a failure never reaches your app. Only the path (no query string), referer (no query string), IP, user agent, method and status are sent, never headers or cookies. `await tracker.close()` waits for visits still being sent.

Tests: `node --test ../../tests/test_nodejs_middleware.js`. Example: `examples/express-app.js`.
