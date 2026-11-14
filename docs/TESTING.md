# Testing

`python3 tests/run_all_tests.py` runs everything; pass names to run some (`node`, `pwa`, `python`, `php`, `worker`, `registry`).

| Suite | Command | Needs |
|---|---|---|
| Registry contract | `python3 -I tests/test_registry.py` | Python |
| Node core + middleware | `node --test tests/test_nodejs_middleware.js` | `npm install` |
| PWA assets (manifest, icons, service worker rules) | `node --test tests/test_pwa_assets.js` | Node |
| Python core, Flask, Django | `python3 -I tests/test_python_core.py` | `pip install flask django` |
| PHP | `php tests/test_php_detector.php && php tests/test_php_tracker.php` | PHP 7.4+ with PDO sqlite |
| Worker (runs in the Workers runtime) | `cd cloudflare && npm test` | `npm install` |

Every language runs the same cases from `signatures/fixtures.json`. Adding a bot: edit `signatures/ai-bots.json`, add a fixture, run the suites.
