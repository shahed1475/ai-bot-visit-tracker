# Deployment and sizing

Step by step: [`cloudflare/README.md`](../cloudflare/README.md).

## Free plan sizing

- Worker requests: 100,000/day. With the edge sensor every request to its route counts, bot or human. Use **fail open** on the route.
- D1 writes: 100,000 rows/day. One bot visit is about 4 row writes, so roughly 20,000 bot visits/day. Reads: 5 million rows/day; the dashboard reads rollups and a few bounded raw queries.
- Past those numbers: Workers Paid raises both limits a long way. Or send only the bots you care about (`ai=1` data) from your middleware.

## Retention

`RETENTION_DAYS` (default 90, set in `wrangler.jsonc` vars). The daily cron deletes older rows in chunks of 1,000.

## Rotating secrets

`npx wrangler secret put INGEST_KEY`, then update the middleware and the sensor. Changing `SESSION_SECRET` signs everyone out.

## Backups

`npx wrangler d1 export ai-bot-tracker --remote --output backup.sql`
