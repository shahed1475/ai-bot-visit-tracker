# Cloudflare AI Bot Tracker + Dashboard — Design

Status: approved by owner ("go") on 2026-11-14.

## Intent
Finish the AI Bot Visit Tracker: fix the broken Node core and middleware, add a real dashboard, and make the system deployable on Cloudflare. Primary use: the owner's own site(s); published as open source.

## Goals
- Correctly detect current AI crawlers and classify them by vendor-declared purpose: `training`, `indexing` (search), `retrieval` (user-triggered), else `unknown`.
- Verify claimed bots against vendor-published IP ranges (`verified` / `unverified`).
- Cloudflare deployment: tracker Worker (dashboard + API + ingest + cron) on D1, plus an optional edge-sensor Worker in front of a site.
- Dashboard: KPIs, trend by purpose, bots, pages, activity heatmap, live feed, export, dark mode, mobile.
- Node, Flask, Django, PHP middleware fixed, using one shared bot registry, with a "report to Cloudflare" mode.

## Non-goals / anti-goals
- No change that can take down a monitored site (sensor fails open, never blocks).
- No unmeasured performance claims in docs. No MySQL/PostgreSQL claims unless implemented.
- No deploy to the owner's account without explicit confirmation.

## Approaches considered
1. **Two Workers + D1, middleware report via HTTP (chosen).** Isolation; sensor is tiny and fail-safe.
2. One Worker doing sensor + dashboard: dashboard assets could shadow site paths; a bug hits the site. Rejected.
3. Keep Node/SQLite app on a VPS behind Cloudflare: not "on Cloudflare"; rejected.

## Design
- `signatures/ai-bots.json`: single registry (id, name, operator, kind ai|search|social, purpose, UA regex, robots token, IP-range source URL). Consumed by Worker, Node, Python, PHP; shared fixtures in `signatures/fixtures.json`.
- `cloudflare/` (self-contained, Wrangler 4, TypeScript): `src/` (detect, classify, cidr verify, ingest, stats, auth, cron), `migrations/`, `public/` (vanilla JS dashboard, hand-drawn SVG charts), `test/` (Vitest + workers pool), `sensor/` (edge Worker).
- D1: `visits` (raw, minimal indexes) + `visit_hourly` rollup (upserted in the same batch) + `ip_ranges`. Dashboard reads rollups. Retention default 90 days via cron; IP ranges refreshed daily.
- Auth: `DASHBOARD_PASSWORD` -> HMAC-signed HttpOnly cookie; `INGEST_KEY` bearer for ingest; optional Cloudflare Access.
- `request.cf` supplies country/ASN/org.

## Decisions made by the builder (correctable)
Wrangler (stable) instead of beta `cf`; TypeScript; no frontend build step; 90-day retention; social/search crawlers kept but tagged and hidden behind an "AI only" default filter.

## Left to implementation
Exact SQL, UI visual design (done via frontend-design/dataviz guidance), final verified IP-range source URLs.
