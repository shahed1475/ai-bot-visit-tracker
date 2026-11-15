# Tracker API

Base URL: your Worker. JSON everywhere. Errors look like `{"error": "code"}`.

## Ingest (Bearer sending key)

`POST /api/ingest` with `Authorization: Bearer abt_...` (a sending key of one site) and one event or `{"events":[...]}` (max 100 events, max 256 KB). The key decides which site, and so which user, owns the visit; a `site` field in the payload is ignored.

| Field | Required | Notes |
|---|---|---|
| `ua` | yes | user agent (cut to 512 chars) |
| `path` | yes | query string and fragment are stripped |
| `ip`, `method`, `status`, `referer`, `country`, `asn`, `asOrg`, `ts` | no | `ts` is unix seconds (milliseconds accepted) |

Response: `{"stored":n,"ignored":n,"rejected":n}`. Non-bot user agents are ignored. Errors: 401 unknown, revoked or rotated key (a read key `abtr_...` is also refused here), 405 method, 400 bad JSON or too many events, 413 too large.

## Accounts (cookie session `abt_session`, HttpOnly, 30 days)

| Endpoint | Body | Result |
|---|---|---|
| `POST /api/auth/signup` | `{email, password}` (10 to 128 chars) | 201 and a session; 400 `invalid_email`/`weak_password`; 409 `email_taken`; 429 |
| `POST /api/auth/login` | `{email, password}` | 200 and a session; 401 `invalid_credentials`; 429 |
| `POST /api/auth/logout` | | deletes the session row |
| `GET /api/auth/me` | | `{authenticated, email}` |
| `POST /api/auth/password` | `{current, next}` | changes it and signs out other sessions |
| `DELETE /api/auth/account` | `{password}` | deletes the account, sites and all visits |
| `GET /api/config` | | `{turnstileSiteKey}` (null unless spam protection is on) |

State-changing requests with an `Origin` header that is not this site are rejected (403).

## Sites (session required)

`GET /api/sites` lists your sites (max 5). `POST /api/sites {hostname}` creates one and returns `{site, key}`; the key is shown once. Every site is created with a sending key named `Default`. `POST /api/sites/:id/rotate-key` replaces that Default key: it returns a new key and the old one stops working; other keys you made for the site keep working. `DELETE /api/sites/:id` removes the site, its visits and its keys. A site that is not yours returns 404. Each site in the list has `keyPrefix` (the Default key's first 10 characters, or `null` if you revoked it).

## API keys (session required)

A user can hold up to 20 keys in total (each site's Default key counts). Secrets are shown once, in the response that creates them, and only a SHA-256 hash is stored.

| Endpoint | Body | Result |
|---|---|---|
| `GET /api/keys` | | `{keys:[{id, name, kind, siteId, hostname, keyPrefix, createdAt, lastUsedAt}], max}`; never the secret |
| `POST /api/keys` | `{name, kind, siteId?}` | 201 `{key, apiKey}`. `name` is 1 to 40 characters. `kind` is `ingest` (sending key, `abt_...`, needs `siteId`) or `read` (read key, `abtr_...`, `siteId` optional: leave it out for all your sites). 400 `invalid_name`, `invalid_kind`, `site_required`, `invalid_site`; 404 `site_not_found`; 403 `key_limit` |
| `DELETE /api/keys/:id` | | revokes it at once; 404 for a key that is not yours |

`lastUsedAt` is refreshed at most once a minute per key.

## Read API (Bearer read key)

`GET /api/v1/...` with `Authorization: Bearer abtr_...` returns the same data as the dashboard API below, through the same code: `/api/v1/summary`, `timeseries`, `bots`, `pages`, `heatmap`, `recent`, `export.csv`, `export.json`, with the same `range`, `site` and `ai` parameters. `/api/v1/sites` lists the sites the key can see (`{sites:[{id, hostname}]}`). A key made for one site only ever sees that site (another `site` returns 404); a key made for all sites sees all of its owner's sites and nobody else's.

```bash
curl -H "Authorization: Bearer abtr_your_read_key" "https://your-tracker.example/api/v1/summary?range=7d"
```

Only `GET` is accepted (405 otherwise), and read keys cannot send visits or manage keys. Sending keys do not work here, and neither key type works on the cookie-only `/api/*` endpoints. A missing, wrong or revoked key returns 401.

## Dashboard API (session required)

All `GET`. Query: `range=24h|7d|30d|90d` (default 7d), `site=<site id>|all`, `ai=1|0` (default 1: AI bots only). A `site` that is not yours returns 404.

| Endpoint | Returns |
|---|---|
| `/api/summary` | hits, previous period, delta %, bots, pages, byPurpose, verifiedPct, unverified, sites `[{id, hostname}]` |
| `/api/timeseries` | zero-filled buckets (hourly for 24h, else daily) split by purpose |
| `/api/bots` | top 25 bots with purpose and verified/unverified counts |
| `/api/pages` | top 20 pages with bots and purpose mix |
| `/api/heatmap` | visits by weekday and hour (UTC) |
| `/api/recent?limit=50` | latest visits (max 200) |
| `/api/export.csv`, `/api/export.json` | up to 10,000 visits; CSV cells starting with `= + - @` are prefixed with `'` |

`GET /api/health` needs no auth. It runs a real D1 query and returns `{"ok":true,"db":true,"rangesAgeHours":3}` (`rangesAgeHours` is how long ago the vendor IP ranges were refreshed, `null` before the first cron run), or `503 {"ok":false,"db":false}` when the database is unreachable. Point an uptime monitor at it and alert on non-200; a `rangesAgeHours` above 48 means the daily cron is failing.
