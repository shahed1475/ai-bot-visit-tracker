# Troubleshooting

- **A bot visit is missing.** The user agent must match `signatures/ai-bots.json` (or look like a generic crawler). Test: `curl -A "GPTBot/1.4" https://your-site/`.
- **"IP check: unknown" for everything.** The cron job has not run yet (or the vendor publishes no ranges, e.g. Anthropic). Locally: `curl "localhost:8787/__scheduled?cron=17+3+*+*+*"`.
- **Everything shows "Unverified".** Your middleware sees a proxy IP. Behind Cloudflare set `trust_cloudflare_headers`; for the sensor this is automatic.
- **Dashboard login loops.** The cookie is `Secure`; use HTTPS or `localhost`.
- **Error 1027 on your site.** The sensor exhausted the free Worker quota and the route is "fail closed". Switch the route to fail open.
- **Ingest returns 401.** The site key is wrong, was rotated, or is missing the `Bearer ` prefix. Keys start with `abt_`.
- **Forgot your password.** No email is sent. The operator runs `npm run admin -- reset-password <email> <new password>` in `cloudflare/`.
- **Flask/Django stores nothing.** Check the database path is writable; run with `async_logging: False` to see errors synchronously.
- **Sign up works but login is slow or fails with 1102 on the free plan.** Hashing must run in the `PasswordHasher` Durable Object; make sure the deploy included the `durable_objects` binding and migration.
