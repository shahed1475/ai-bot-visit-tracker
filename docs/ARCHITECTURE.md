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
- Query strings are stripped everywhere; sensitive headers (cookies, authorization) are never stored.
