# Tracker API

Base URL: your Worker. JSON everywhere. Errors look like `{"error": "code"}`.

## Ingest (Bearer site key)

`POST /api/ingest` with `Authorization: Bearer abt_...` (the key of one site) and one event or `{"events":[...]}` (max 100 events, max 256 KB). The key decides which site, and so which user, owns the visit; a `site` field in the payload is ignored.

| Field | Required | Notes |
|---|---|---|
| `ua` | yes | user agent (cut to 512 chars) |
| `path` | yes | query string and fragment are stripped |
| `ip`, `method`, `status`, `referer`, `country`, `asn`, `asOrg`, `ts` | no | `ts` is unix seconds (milliseconds accepted) |

Response: `{"stored":n,"ignored":n,"rejected":n}`. Non-bot user agents are ignored. Errors: 401 unknown or rotated key, 405 method, 400 bad JSON or too many events, 413 too large.

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

`GET /api/sites` lists your sites (max 5). `POST /api/sites {hostname}` creates one and returns `{site, key}`; the key is shown once. `POST /api/sites/:id/rotate-key` returns a new key and invalidates the old one. `DELETE /api/sites/:id` removes the site and its visits. A site that is not yours returns 404.

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

`GET /api/health` returns `{"ok":true}` without auth.
