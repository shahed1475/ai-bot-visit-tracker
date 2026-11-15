# Cloudflare tracker (Worker + D1 + dashboard)

One Worker serves the dashboard, the JSON API and the ingest endpoint, stores visits in D1, and runs a daily cron job (refresh vendor IP ranges, delete rows older than `RETENTION_DAYS`, default 90).

## Run it locally

```bash
cd cloudflare
npm install
npx wrangler d1 migrations apply ai-bot-tracker --local
npx wrangler dev --test-scheduled       # http://localhost:8787
curl "localhost:8787/cdn-cgi/handler/scheduled?cron=17+3+*+*+*"   # loads vendor IP ranges (needs internet)
npm run seed                            # creates demo@example.com / demo-password-123 with two sites and fake visits
```
Open `/` for the home page, `/demo/` for the live demo, `/signup` to create an account.

## Deploy

```bash
npx wrangler login
npx wrangler deploy                          # creates the D1 database and the password-hashing Durable Object
npx wrangler d1 migrations apply ai-bot-tracker --remote
```
No secrets are required. Open the `*.workers.dev` URL, create the first account, add a site, and copy its key. For your own hostname add a custom domain in the Cloudflare dashboard (Worker, Settings, Domains).

Optional spam protection for signups: create a Cloudflare Turnstile widget, then `npx wrangler secret put TURNSTILE_SECRET` and add `TURNSTILE_SITEKEY` under `vars` in `wrangler.jsonc`. When both are set the signup page shows the check.

Why a Durable Object: password hashing (PBKDF2, 100,000 rounds) takes about 40 ms of CPU, more than the 10 ms the Workers free plan allows per request. Durable Objects allow 30 seconds, so hashing happens there and works on the free plan.

Forgot a password? There is no email service, so use the operator tool: `npm run admin -- reset-password user@example.com "new password"`.

## Collect visits

Each user sees the exact steps, with their own key, in the setup guide at `/docs/`. In short:

- **Edge sensor** (sites proxied by Cloudflare): paste `public/downloads/edge-sensor.js` into a Worker in the site owner's Cloudflare account, set `TRACKER_URL` and the secret `TRACKER_KEY`, add the route, choose **fail open**. Rebuild the file after changing the sensor with `npm run build:sensor`.
- **Server middleware** (Node, Flask, Django, PHP): `report: { endpoint, key, site }`. **Anything else:** one HTTPS call.

```bash
curl -X POST https://<your-worker>/api/ingest -H "Authorization: Bearer abt_<site key>" -H "Content-Type: application/json" \
  -d '{"ip":"132.196.86.5","ua":"compatible; GPTBot/1.4","path":"/"}'
```

## Read your stats from a script

In **Sites and account**, create a **read key** (`abtr_...`), for all your sites or for one. It reads the same numbers as the dashboard, and nothing else:

```bash
curl -H "Authorization: Bearer abtr_<read key>" "https://<your-worker>/api/v1/summary?range=7d"
```
Endpoints: `summary`, `timeseries`, `bots`, `pages`, `heatmap`, `recent`, `export.csv`, `export.json`, `sites`. See `docs/API.md`. Make one sending key per server or sensor and one read key per tool, so each can be revoked on its own.

## Notes

- Tables: `visits` (raw, 2 indexes), `visit_hourly` (rollup the dashboard reads), `api_keys`, `ip_ranges`, `meta`. Query strings are stripped before storage.
- Each bot visit costs about 4 D1 row writes (row, two indexes, rollup). Free plan: 100,000 writes/day.
- The dashboard sends a strict Content-Security-Policy (`public/_headers`) and builds every element with DOM APIs, because user agents and paths are attacker-controlled.
- Login is rate limited (10 failures per IP and 20 per account per hour); signup 5 per IP per hour. Sessions are random tokens stored hashed, valid 30 days, deleted on logout.
- Tenant isolation: every query is scoped by the signed-in user's sites (or by the sites of the read key's owner); keys live in `api_keys`, are stored as SHA-256 hashes and are shown once. A user can hold 20 keys.
- Deploy to Cloudflare button URL pattern: `https://deploy.workers.cloudflare.com/?url=https://github.com/<you>/<repo>/tree/main/cloudflare`
