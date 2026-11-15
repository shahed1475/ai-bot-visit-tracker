# Deployment and sizing

Step by step: [`cloudflare/README.md`](../cloudflare/README.md).

## Free plan sizing

- Worker requests: 100,000/day. With the edge sensor every request to its route counts, bot or human. Use **fail open** on the route.
- D1 writes: 100,000 rows/day. One bot visit is about 4 row writes, so roughly 20,000 bot visits/day. (Each key also records when it was last used, at most once a minute.) Reads: 5 million rows/day; the dashboard reads rollups and a few bounded raw queries.
- Past those numbers: Workers Paid raises both limits a long way. Or send only the bots you care about (`ai=1` data) from your middleware.

## Retention

`RETENTION_DAYS` (default 90, set in `wrangler.jsonc` vars). The daily cron deletes older rows in chunks of 1,000.

## Keys and secrets

The tracker needs no secrets to run. Keys belong to users and live in D1 (stored as SHA-256 hashes, shown once).

- **Rotate or revoke a key:** Settings, then Sites and account. "Rotate key" replaces a site's Default key; "Revoke" removes any key, and it stops working at once. Then update the middleware or sensor that used it.
- **Optional spam protection for signups:** the Turnstile secret is the only secret the tracker can use (see `cloudflare/README.md`).
- **Sessions** are random tokens stored hashed in D1. Changing a password signs out the account's other devices.

## Backups

`npx wrangler d1 export ai-bot-tracker --remote --output backup.sql`
