# Multi-user product site: design (approved "goahead" 2026-11-14)

Goal: public home page + signup, so other people can use the tracker; each user gets private sites, per-site keys, and a dashboard.

Decisions
- Email + password. PBKDF2-SHA256 100k rounds inside a Durable Object (`PasswordHasher`): Workers free plan allows 10 ms CPU, hashing measured 38 ms; DOs allow 30 s. No email service, so no verification/reset email; admin script resets passwords.
- Sessions: random token in an HttpOnly Lax cookie, sha256 stored in D1, 30 day absolute expiry, deleted on logout.
- Tenancy: every visit row carries `site_id`; every read/write is scoped through the caller's `sites.user_id`. Site keys `abt_...` are shown once and stored as sha256.
- Edge sensor sends events over HTTPS with the site key (users deploy it in their own Cloudflare account, so it cannot bind to this D1).
- Demo: client-side sample data, same dashboard code, no backend.
- Pre-release migration drops and rebuilds visits tables (no real data existed).
- Not included: pricing, testimonials, email flows, OAuth sign-in. Legal pages are drafts.
Plan: backend + tests, sensor, brand, public pages, app + demo, PWA/SEO, browser QA, gated deploy.
