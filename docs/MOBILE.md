# Using the dashboard on your phone

The dashboard is a Progressive Web App (PWA): open your tracker URL on your phone (sign in, or try `/demo/`) and install it like an app. No app store needed.

## Install

- **Android (Chrome):** open the dashboard, tap **More**, then **Install app** (or Chrome menu, **Install app**).
- **iPhone / iPad (Safari):** tap **Share**, then **Add to Home Screen**. The More menu shows this hint on iOS.
- **Desktop Chrome/Edge:** the install icon in the address bar, or **More**, **Install app**.

Installed, it opens full screen with its own icon, the phone status bar follows the light/dark theme, and long-press on the icon offers shortcuts (Last 24 hours, Last 7 days, Live feed).

## What works offline

The app shell (page, styles, fonts, icons) opens without a connection and shows an offline notice. **Data is never stored on the phone**: your visitor IPs and pages are private, so the service worker never caches `/api/*`. When the connection returns the dashboard refreshes by itself.

## Phone layout

- Bottom tab bar (Overview, Bots, Pages, Live) that highlights the section you are in.
- 44px touch targets, 16px inputs (no iOS zoom), safe-area padding for notches and home bars.
- Charts redraw at your screen width so labels stay readable; tap a bar or a heatmap cell for details.
- Tables become cards; long lists show 8 rows with **Show all**.

## Turning it into a store app later

You do not need to change the dashboard. Every request is same-origin and login uses a cookie, so any wrapper that loads your deployed URL works.

- **Android (Play Store):** use [PWABuilder](https://www.pwabuilder.com) or Bubblewrap to wrap the URL as a Trusted Web Activity. It needs HTTPS on your own domain and a file at `cloudflare/public/.well-known/assetlinks.json` (the tool generates its contents).
- **iOS and Android with one project:** [Capacitor](https://capacitorjs.com) with `server.url` set to your Worker URL. Because the web view loads your origin, cookie login keeps working.
- **Not built yet:** push notifications (for example "a new AI bot appeared"). They would need a subscription endpoint in the Worker.

## Developer notes

- `cloudflare/public/sw.js`: network first, cache as offline fallback, never touches `/api/*`. Bump `VERSION` to drop old caches.
- `cloudflare/public/manifest.webmanifest` and `icons/` (regenerate icons with any tool; sizes are checked by `tests/test_pwa_assets.js`).
- `_headers` sets a strict CSP that already allows the manifest and the service worker.
