# Architecture

- **`signatures/`**: the single bot registry and shared test fixtures. Rule: first match wins. Every language loads the same JSON.
- **`cloudflare/`**: tracker Worker (`src/`), dashboard (`public/`), D1 migrations, edge sensor (`sensor/`).
- **`core/`, `middleware/`**: Node, Python and PHP detectors and middleware. Each one detects with the registry, classifies by declared purpose, stores locally in SQLite and/or reports to the tracker.

## Decisions

- Classification trusts the vendor-declared purpose in the user agent. Heuristics (referer, frequency) only run for crawlers that declare nothing.
- IP ranges verify a claimed bot; they never detect one. Cloud IPs are shared with ordinary customers.
- Forwarded-IP headers are not trusted unless you opt in (`trust_cloudflare_headers`, `trust_proxy_headers`), otherwise anyone could fake a verified bot.
- Two Workers: the dashboard can never break your site, and dashboard files can never shadow your site's paths.
- D1 stores raw visits plus an hourly rollup. Dashboard charts read the rollup, so reads stay cheap on the free plan.
- Query strings are stripped everywhere, at the source (every middleware and the sensor) and again by the tracker; sensitive headers (cookies, authorization) are never sent or stored.
- Keys live in `api_keys` as SHA-256 hashes and are shown once. A *sending* key (`abt_`) belongs to one site and can only ingest. A *read* key (`abtr_`) can only `GET /api/v1/*`, which runs the same code as the dashboard API scoped to the key's owner (or to one site). A user can hold 20 keys, and each key records when it was last used (at most once a minute).
- Tenancy: every visit row carries a `site_id`, and every read or write is scoped through the caller's `sites.user_id`. The scope comes from the session or key, never from the request.
- The public pages share one look under `body.pub`. The dashboard shares the same CSS files, so new class names must not collide with it.
