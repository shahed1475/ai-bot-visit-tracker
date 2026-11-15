# Cloudflare AI Bot Tracker + Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the multi-language AI bot tracker, add a dashboard, and ship a Cloudflare-deployable tracker (Worker + D1) with an optional edge sensor.

**Architecture:** A shared bot registry (`signatures/ai-bots.json`) drives detection in every language. A tracker Worker (D1, static dashboard, ingest/stats API, cron) is separate from a tiny fail-open edge-sensor Worker. Legacy middleware can report to the tracker over HTTP.

**Tech Stack:** TypeScript, Wrangler 4 (stable), D1, Workers Static Assets, Vitest + `@cloudflare/vitest-pool-workers`, vanilla JS/SVG dashboard; Node 22, Python 3 (Flask/Django), PHP 8.

**Spec:** `docs/superpowers/specs/2026-11-14-cloudflare-tracker-design.md`

## Global Constraints
- Purposes are exactly `training | indexing | retrieval | unknown`; kinds are `ai | search | social | other`.
- Verification values: `verified | unverified | unknown` (unknown = no published ranges).
- Sensor never blocks or throws to the visitor (fail open).
- Retention default 90 days; IP ranges refreshed daily by cron.
- Worker D1 writes per visit: one batch of visit insert + hourly rollup upsert.
- Wrangler config is `wrangler.jsonc`; compatibility date = today at creation.
- No secrets in git; `DASHBOARD_PASSWORD`, `INGEST_KEY`, `SESSION_SECRET` are Worker secrets.
- No deploy to the owner's account without explicit confirmation.
- Docs make no unmeasured performance claims.

## Review Focus
- Empty/missing/huge User-Agent: no crash, stored truncated to 512 chars.
- IPv6 and IPv4-mapped IPv6 in CIDR verification.
- Human traffic on the sensor: zero D1 writes, original response untouched.
- D1 down or over free quota: sensor still returns the origin response.
- Login brute force / wrong password: 401, constant-time compare, no cookie.
- Ingest with bad key, oversize body, or batch > 100 events: 401/413/400.
- Spoofed UA ("GPTBot" from a non-OpenAI IP): stored as `unverified`.

---

### Task 1: Baseline and shared registry
**Files:** Create `signatures/ai-bots.json`, `signatures/fixtures.json`, `signatures/README.md`; Test `tests/test_registry.py`.
**Interfaces:** Produces registry entries `{id,name,operator,kind,purpose,ua (regex string, case-insensitive),robots,ipSource|null,docs}`; fixtures `[{ua, ip?, expect:{botId|null,kind,purpose}}]`.
- [ ] Step 1: Write `tests/test_registry.py` asserting: JSON valid; unique ids; every `ua` compiles; fixtures include real UAs for GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User, Bytespider, Amazonbot, meta-externalagent, CCBot, Google-CloudVertexBot, Applebot, DuckAssistBot, MistralAI-User, Googlebot, bingbot, a Chrome browser, a LinkedInApp in-app browser (expect null), empty UA (expect null).
- [ ] Step 2: Run `python3 -I -m unittest tests/test_registry.py` -> FAIL (files missing).
- [ ] Step 3: Author the registry from the researched Cloudflare/OpenAI/Anthropic/Perplexity lists; more specific tokens listed first (OAI-SearchBot before GPTBot). Social/search crawlers use kind `social`/`search`.
- [ ] Step 4: Re-run -> PASS.

### Task 2: Worker scaffold, schema, config
**Files:** Create `cloudflare/{package.json,wrangler.jsonc,tsconfig.json,vitest.config.ts,migrations/0001_init.sql,src/index.ts}`.
**Interfaces:** Produces `Env {DB: D1Database; ASSETS: Fetcher; DASHBOARD_PASSWORD; INGEST_KEY; SESSION_SECRET; RETENTION_DAYS?}`; tables `visits(id,ts,site,ip,bot_id,bot_name,operator,kind,purpose,verified,path,method,status,ua,referer,country,asn,as_org,source)`, `visit_hourly(hour,site,bot_id,purpose,verified,hits; PK hour,site,bot_id,purpose,verified)`, `ip_ranges(bot_id,cidr; PK)`.
- [ ] Step 1: Test: applying migrations in the workers pool creates the three tables; `GET /api/health` returns `{ok:true}`.
- [ ] Step 2: Run `npm test` in `cloudflare/` -> FAIL.
- [ ] Step 3: Scaffold; indexes only `visits(ts)` and `visits(bot_id,ts)`; observability enabled; assets dir `public/` with `run_worker_first` for `/api/*`.
- [ ] Step 4: `npm test` -> PASS; `npx wrangler deploy --dry-run` succeeds.

### Task 3: Detection, classification, CIDR verification (TS)
**Files:** Create `cloudflare/src/{detect.ts,cidr.ts,registry.ts}`; Test `cloudflare/test/{detect,cidr}.test.ts`.
**Interfaces:** `detect(ua: string): Match|null` (`Match={id,name,operator,kind,purpose}`); `inRanges(ip: string, cidrs: string[]): boolean` (IPv4, IPv6, IPv4-mapped); `verify(match, ip, ranges: Map<string,string[]>): 'verified'|'unverified'|'unknown'`.
- [ ] Step 1: Tests iterate `signatures/fixtures.json` (imported); CIDR tests: `132.196.86.5` in `20.15.240.64/26`, boundary addresses, IPv6 `/32`, `::ffff:1.2.3.4`, garbage input -> false; verify tests for spoofed UA -> `unverified`, no ranges -> `unknown`.
- [ ] Step 2: Run -> FAIL. Step 3: Implement (registry imported as JSON; unmatched UA falls back to generic `bot|crawler|spider` -> kind `other`, purpose `unknown`). Step 4: Run -> PASS.

### Task 4: Ingest, sensor logic, stats store
**Files:** Create `cloudflare/src/{store.ts,ingest.ts}`; Test `cloudflare/test/ingest.test.ts`.
**Interfaces:** `recordVisit(env, ev: VisitEvent, ctxCf?): Promise<void>` (batch: insert + rollup upsert, ua truncated); `POST /api/ingest` accepts one event or `{events:[...]}` (<=100), Bearer `INGEST_KEY`; `VisitEvent={ts?,site,ip,ua,path,method?,status?,referer?}`.
- [ ] Step 1: Tests: valid ingest of GPTBot stores row + rollup hits=1, repeat increments; human UA stored only if `?all=1` is not set -> ignored (200, `stored:0`); bad key 401; 101 events 400; body >256KB 413; spoofed IP -> `unverified`.
- [ ] Step 2-4: Fail, implement, pass.

### Task 5: Auth and stats API
**Files:** Create `cloudflare/src/{auth.ts,api.ts}`; Test `cloudflare/test/api.test.ts`.
**Interfaces:** `POST /api/login {password}` -> HMAC cookie `abt_session` (HttpOnly, Secure, SameSite=Strict, 7d); `GET /api/summary?range=24h|7d|30d|90d&site=&ai=1`, `/api/timeseries`, `/api/bots`, `/api/pages`, `/api/heatmap`, `/api/recent?limit=`, `/api/export.csv|json`; all except health/login/ingest require session.
- [ ] Step 1: Tests: unauthenticated 401; wrong password 401 no cookie; correct password sets cookie; summary numbers match seeded rows incl. delta vs previous period; `ai=1` excludes kind `social`/`search`; CSV escapes quotes and leading `=` (formula injection).
- [ ] Step 2-4: Fail, implement (rollup tables for summary/timeseries/bots/heatmap), pass.

### Task 6: Cron and edge sensor
**Files:** Create `cloudflare/src/cron.ts`, `cloudflare/sensor/{wrangler.jsonc,src/index.ts}`; Test `cloudflare/test/cron.test.ts`, `cloudflare/sensor/test/sensor.test.ts`.
**Interfaces:** `scheduled` handler: `refreshIpRanges(env, fetchFn)` and `purgeOld(env, days)` (chunks of 1000); sensor forwards `fetch(request)` and, for bot UAs only, `ctx.waitUntil(recordVisit via same D1 binding)` wrapped in try/catch.
- [ ] Step 1: Tests: purge keeps rows newer than cutoff; refresh parses `{prefixes:[{ipv4Prefix|ipv6Prefix}]}` and tolerates a failing source; sensor: human request -> no writes and response identical; bot -> one row; D1 throwing -> origin response still returned.
- [ ] Step 2-4: Fail, implement, pass. Verify real range URLs with `curl` and record them in the registry.

### Task 7: Dashboard
**Files:** Create `cloudflare/public/{index.html,app.js,charts.js,style.css,login.html}`.
**Interfaces:** Consumes Task 5 endpoints. Produces: KPI strip, stacked trend by purpose, bots ranking, purpose split, top pages, day×hour heatmap, live feed (auto-refresh 30s), site/range/AI-only filters, export buttons, dark mode, mobile layout.
- [ ] Step 1: Follow frontend-design (plan tokens, review against brief) and dataviz (run `validate_palette.js` on the categorical palette, light+dark) before coding.
- [ ] Step 2: Build; seed local D1 with a script `cloudflare/scripts/seed.ts` (~2k varied visits).
- [ ] Step 3: Run `npx wrangler dev`, screenshot desktop+mobile, light+dark in Chrome; fix collisions/overflow; check keyboard focus and reduced motion. Expected: no console errors.

### Task 8: Node core and middleware
**Files:** Modify `core/bot-detector.js`, `core/classifier.js`, `core/database.js`, `middleware/nodejs/{index.js,ai-bot-tracker.js}`, `demo/server.js`; Create `core/reporter.js`; Test `tests/test_nodejs_middleware.js`.
**Interfaces:** `detectBot(ua, ip) -> {isBot,botId,botName,kind,purpose,confidence,method}` (registry-driven); one canonical Express middleware (`index.js`), `ai-bot-tracker.js` re-exports it; `reporter.send(events)` POSTs to `${endpoint}/api/ingest` with timeout 2s, never throws; no per-instance request state.
- [ ] Step 1: Tests: all fixtures; human request never logged; middleware logs bot with correct fields (SQLite in temp dir); reporter failure doesn't affect response. Step 2-4: `npm install` (root), fail, implement, pass. Remove PostgreSQL/MySQL claims or implement-by-throwing-clear-error.

### Task 9: Flask, Django, PHP
**Files:** Modify `core/*_python.py`, `middleware/python/**`, `middleware/php/src/*`; add reporter in each; fix `\d` raw-string at `middleware/python/django/ai_bot_tracker/middleware.py:280`; Tests `tests/test_*`, new `middleware/php/tests/FixturesTest.php`.
- [ ] Step 1: Create venv in scratchpad; install flask/django; run existing tests to record baseline failures.
- [ ] Step 2: Make each detector load `signatures/ai-bots.json` and pass all fixtures; add reporter (fire-and-forget).
- [ ] Step 3: Run `python3 tests/run_all_tests.py` and `php` fixture test -> all PASS.

### Task 10: Docs, CI, deploy guide, final verification
**Files:** Modify `README.md`, `docs/{DEPLOYMENT,SETUP,API}.md`; Create `.github/workflows/ci.yml`, `cloudflare/README.md`, `docs/CLOUDFLARE.md`.
- [ ] Step 1: Rewrite README honestly (features that exist, three purposes, verification, Cloudflare quick start, Deploy-to-Cloudflare button, free-tier notes, Cloudflare AI Crawl Control comparison).
- [ ] Step 2: CI runs registry, Worker, Node, Python, PHP tests.
- [ ] Step 3: Full run: all test suites, `wrangler deploy --dry-run` for both Workers, local end-to-end (`curl` with GPTBot/Claude-User UAs -> appears in dashboard), code review pass (`/code-review`) and fix findings.

### Task 11: Deploy (gated)
- [ ] Ask the owner to confirm and run `npx wrangler login`; then create D1, apply migrations, set three secrets, deploy tracker, (optionally) sensor with route, smoke-test with curl and the browser. Never run without explicit confirmation.
