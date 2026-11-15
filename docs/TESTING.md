# Testing

`python3 tests/run_all_tests.py` runs everything; pass names to run some (`node`, `pwa`, `python`, `php`, `worker`, `registry`).

CI runs all of these plus the end-to-end run below.

| Suite | Command | Needs |
|---|---|---|
| Registry contract | `python3 -I tests/test_registry.py` | Python |
| Node core + middleware | `node --test tests/test_nodejs_middleware.js` | `npm install` |
| PWA assets (manifest, icons, service worker rules) | `node --test tests/test_pwa_assets.js` | Node |
| Python core, Flask, Django | `python3 -I tests/test_python_core.py` | `pip install flask django` |
| PHP | `php tests/test_php_detector.php && php tests/test_php_tracker.php && php tests/test_php_reporter.php` | PHP 7.4+ with PDO sqlite |
| Worker (runs in the Workers runtime) | `cd cloudflare && npm test` | `npm install` |

## End to end

`node tests/e2e/run.mjs` starts a real tracker (`wrangler dev` on a throwaway local database) and a real app for each integration, then checks what arrives. It covers:

- every bot in the registry, sent over HTTP and checked against its expected kind and purpose;
- IP verification with the live vendor ranges, loaded by the real cron job (skipped offline): IPv4, IPv6, IPv4-mapped IPv6 and spoofed addresses;
- security: bad or wrong-type keys, oversized and malformed bodies, 101 events, markup and SQL in user agents and paths, spreadsheet formulas in the CSV export, tenant isolation, cross-site requests;
- the Node, Flask, Django and PHP middleware, each serving real requests: bots are reported with the right fields and status, people never are, a tracker that is down never slows or breaks the page, and a recording proxy checks what really left the server (no query strings, cookies or headers);
- the edge sensor's logic against a stub origin: untouched responses, origin status codes, fail open when the tracker is down or rejects the key.

Needs `npm install` in `cloudflare/` and the repo root, `php`, and a Python with flask and django (`PYTHON=/path/to/python`). `E2E_ONLY=node,php` runs only some sections. It never touches your real database or Cloudflare account.

Every language runs the same cases from `signatures/fixtures.json`. Adding a bot: edit `signatures/ai-bots.json`, add a fixture, run the suites.
