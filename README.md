# AI Bot Visit Tracker

See which AI crawlers read your website, why they came, and which pages they took.

- **Dashboard** on Cloudflare (Workers + D1): visits over time, who is visiting, what they read, when they come, live feed, CSV/JSON export, light and dark mode.
- **Works on your phone.** Mobile-first layout, bottom tab bar, and installable as an app from your home screen (PWA). See [`docs/MOBILE.md`](docs/MOBILE.md).
- **Purpose, not guesswork.** OpenAI, Anthropic and Perplexity declare why they crawl in the user agent, so every visit is classified as `training`, `indexing` (search) or `retrieval` (a person asked an assistant).
- **Spoof check.** Vendors publish their crawler IP ranges. A visit that claims to be GPTBot from another IP is flagged `unverified`.
- **Accounts for everyone.** A public home page, a no-signup live demo (`/demo/`), signup and login. Each user gets private sites, named sending keys and read-only API keys, and their own dashboard.
- **Works with any site.** Put the edge sensor in front of a site on Cloudflare (no code changes), or report from Node, Flask, Django, PHP or one HTTPS call.

```
AI bot ─► your site on Cloudflare ─► [edge sensor Worker] ─► your origin
                                        │ never blocks, fails open
Node / Flask / Django / PHP ── POST /api/ingest ─┤
                                                 ▼
                                   [tracker Worker + D1]
                                    ├─ /api/*  stats, export
                                    └─ dashboard (static files)
```

## Quick start

**Dashboard + tracker on Cloudflare** (about 10 minutes): follow [`cloudflare/README.md`](cloudflare/README.md).

**Only the middleware, stored locally in SQLite:**

```bash
# Node (Express)
npm install            # in this repo; copy middleware/nodejs + core + signatures into your app
```
```js
const { AiBotTracker } = require('./middleware/nodejs');
app.use(new AiBotTracker({ database: { type: 'sqlite', path: './data/bot_visits.db' } }).middleware());
```
```python
# Flask:   pip install flask
AiBotTrackerFlask(app, {"database": {"type": "sqlite", "path": "bot_visits.sqlite"}})
# Django:  pip install django   ->  MIDDLEWARE = ["ai_bot_tracker_django.AiBotTrackerMiddleware", ...]
```
```php
$tracker = new AiBotTracker\AiBotTracker(['database' => ['type' => 'sqlite', 'database' => 'bot_visits.db']]);
$tracker->processRequest();
```

Node, Flask, Django and PHP can all send visits to the tracker with `report: { endpoint, key, site }` (use a sending key from your account). See each folder's README and the setup guide at `/docs/`.

## What counts as a bot

One registry, [`signatures/ai-bots.json`](signatures/ai-bots.json), is used by Node, Python, PHP and the Worker. First match wins.

| Purpose | Meaning | Examples |
|---|---|---|
| training | collecting pages to train models | GPTBot, ClaudeBot, Bytespider, CCBot, Meta-ExternalAgent |
| indexing | building a search index that assistants cite | OAI-SearchBot, Claude-SearchBot, PerplexityBot, Applebot |
| retrieval | fetching a page because a person asked | ChatGPT-User, Claude-User, Perplexity-User, DuckAssistBot |

Search engines (Googlebot, Bingbot) and link-preview bots (Slackbot, LinkedInBot) are recorded with their own `kind` and hidden by the dashboard's "AI bots only" filter. Add bots by editing the JSON; `signatures/fixtures.json` holds the shared test cases.

## Tests

```bash
python3 tests/run_all_tests.py     # registry, Node, Python (Flask + Django), PHP, Worker
node tests/e2e/run.mjs             # end to end: a real tracker plus every integration, over real HTTP
```
Needs `npm install` (root and `cloudflare/`), `pip install flask django`, and `php`. CI runs the same suites and the end-to-end run. See [`docs/TESTING.md`](docs/TESTING.md).

## Notes and limits

- Cloudflare's own **AI Crawl Control** also shows crawler activity. This project adds per-page detail, the IP spoof check, non-Cloudflare sites, and data you own and can export.
- Free plan: Workers allow 100,000 requests/day and D1 100,000 row writes/day. Each bot visit writes a few rows, so a small site fits comfortably; see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for sizing and sampling.
- Anthropic publishes no crawler IP ranges, so Claude visits show IP check `unknown`.
- Local middleware stores in SQLite only. For central storage across sites use the Cloudflare tracker.

More: [Mobile app](docs/MOBILE.md), [API](docs/API.md), [Architecture](docs/ARCHITECTURE.md), [Deployment](docs/DEPLOYMENT.md), [Testing](docs/TESTING.md), [Troubleshooting](docs/TROUBLESHOOTING.md). License: MIT.
