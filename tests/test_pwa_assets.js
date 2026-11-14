#!/usr/bin/env node
/** PWA contract: manifest, icons, meta tags, CSP, and the service worker's caching rules. Run: node --test tests/test_pwa_assets.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PUB = path.join(__dirname, '..', 'cloudflare', 'public');
const read = (f) => fs.readFileSync(path.join(PUB, f), 'utf8');
const png = (f) => { const b = fs.readFileSync(path.join(PUB, f)); assert.equal(b.subarray(1, 4).toString(), 'PNG', f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('manifest is installable and complete', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, '/app/');
  assert.equal(m.scope, '/');
  assert.ok(m.id && m.name && m.short_name && m.short_name.length <= 12);
  assert.match(m.theme_color, /^#[0-9a-f]{6}$/i);
  assert.match(m.background_color, /^#[0-9a-f]{6}$/i);
  const has = (size, purpose) => m.icons.some((i) => i.sizes === `${size}x${size}` && i.type === 'image/png' && (i.purpose || 'any').split(' ').includes(purpose));
  assert.ok(has(192, 'any') && has(512, 'any'), 'any icons 192 + 512');
  assert.ok(has(512, 'maskable'), 'maskable 512');
  for (const i of m.icons) { const [w, h] = png(i.src.replace(/^\//, '')); assert.equal(`${w}x${h}`, i.sizes, i.src); }
  assert.ok(m.shortcuts.length >= 1);
  for (const s of m.shortcuts) assert.match(s.url, /^\//);
  assert.deepEqual(png('icons/apple-touch-icon.png'), [180, 180]);
});

test('index.html is mobile and PWA ready', () => {
  const h = read('app/index.html');
  assert.match(h, /name="viewport"[^>]*viewport-fit=cover/);
  assert.match(h, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(h, /rel="apple-touch-icon" href="\/icons\/apple-touch-icon\.png"/);
  assert.match(h, /name="theme-color"[^>]*prefers-color-scheme: light/);
  assert.match(h, /name="theme-color"[^>]*prefers-color-scheme: dark/);
  assert.match(h, /name="apple-mobile-web-app-capable"/);
  assert.doesNotMatch(h, /\sstyle=/, 'inline style attributes break the CSP');
});

test('CSP allows the manifest and service worker and nothing external', () => {
  const csp = read('_headers').match(/Content-Security-Policy: (.+)/)[1];
  assert.match(csp, /manifest-src 'self'/);
  assert.match(csp, /worker-src 'self'/);
  assert.deepEqual([...new Set(csp.match(/https?:\/\/[^\s;]+/g))], ['https://challenges.cloudflare.com'], 'only Turnstile may be external');
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
});

/** Run sw.js in a sandbox with stubbed Cache/fetch and return the registered handlers. */
function loadSW({ fetchImpl }) {
  const handlers = {}, store = new Map(), puts = [];
  const cacheObj = { addAll: async () => {}, put: async (req, res) => { puts.push(new URL(req.url).pathname); store.set(new URL(req.url).pathname, res); } };
  const self = {
    location: new URL('https://t.test/'), addEventListener: (t, fn) => { handlers[t] = fn; },
    skipWaiting: async () => {}, clients: { claim: async () => {} },
  };
  const caches = { open: async () => cacheObj, keys: async () => [], delete: async () => true,
    match: async (req) => store.get(new URL(typeof req === 'string' ? 'https://t.test' + req : req.url).pathname) };
  const ctx = vm.createContext({ self, caches, fetch: fetchImpl, URL, Response: class { constructor(b, o = {}) { this.body = b; this.status = o.status || 200; this.ok = this.status < 400; this.type = 'basic'; } clone() { return this; } }, console });
  vm.runInContext(read('sw.js'), ctx);
  return { handlers, puts, store };
}
const evt = (url, extra = {}) => { const e = { request: { url, method: 'GET', mode: 'cors', ...extra }, responded: null, respondWith(p) { this.responded = p; }, waitUntil() {} }; return e; };

test('service worker never touches API traffic or non-GET requests', async () => {
  const sw = loadSW({ fetchImpl: async () => ({ ok: true, type: 'basic', status: 200, clone() { return this; } }) });
  const api = evt('https://t.test/api/summary?range=7d'); sw.handlers.fetch(api);
  assert.equal(api.responded, null, '/api/* must pass straight to the network');
  const post = evt('https://t.test/app.js', { method: 'POST' }); sw.handlers.fetch(post);
  assert.equal(post.responded, null);
  const other = evt('https://cdn.example.com/x.js'); sw.handlers.fetch(other);
  assert.equal(other.responded, null, 'cross-origin requests are not handled');
  assert.deepEqual(sw.puts, []);
});

test('service worker serves the shell network-first and falls back to cache offline', async () => {
  let online = true;
  const sw = loadSW({ fetchImpl: async () => { if (!online) throw new Error('offline'); return { ok: true, type: 'basic', status: 200, clone() { return this; }, body: 'fresh' }; } });
  const e1 = evt('https://t.test/app.js'); sw.handlers.fetch(e1);
  assert.equal((await e1.responded).body, 'fresh');
  assert.ok(sw.puts.includes('/app.js'), 'successful responses are cached');
  online = false;
  const e2 = evt('https://t.test/app.js'); sw.handlers.fetch(e2);
  assert.equal((await e2.responded).body, 'fresh', 'offline returns the cached copy');
  const e3 = evt('https://t.test/never-seen.js'); sw.handlers.fetch(e3);
  assert.equal((await e3.responded).status, 503);
  sw.store.set('/', { body: 'shell' });
  const nav = evt('https://t.test/some/deep/link', { mode: 'navigate' }); sw.handlers.fetch(nav);
  assert.equal((await nav.responded).body, 'shell', 'offline navigation falls back to the app shell');
});
