#!/usr/bin/env node
/**
 * End-to-end test: a REAL tracker (wrangler dev on a throwaway local D1) and a REAL app for every integration.
 *
 *   node tests/e2e/run.mjs
 *
 * Needs: `npm install` in cloudflare/, node 22, php (with PDO sqlite) and python with flask + django.
 *   PYTHON=/path/to/python   interpreter that has flask and django (default: python3)
 *   E2E_ONLY=tracker,node    run only some sections (tracker, node, flask, django, php, sensor)
 * The vendor IP-range checks use the real vendor URLs and are skipped when offline.
 * Nothing here touches your real database or Cloudflare account.
 */
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const WORKER = path.join(ROOT, 'cloudflare');
const WRANGLER = path.join(WORKER, 'node_modules/.bin/wrangler');
const APPS = path.join(ROOT, 'tests/e2e/apps');
const PY = process.env.PYTHON || 'python3';
const ONLY = (process.env.E2E_ONLY || '').split(',').filter(Boolean);
const want = (s) => ONLY.length === 0 || ONLY.includes(s);
const PORT = { tracker: 8799, sensor: 8798, origin: 8797, proxy: 8796, node: 8801, flask: 8802, django: 8803, php: 8804, dead: 8899 };
const T = `http://127.0.0.1:${PORT.tracker}`;
const PROXY = `http://127.0.0.1:${PORT.proxy}`; // every integration reports through this recorder, so we can inspect what really left the server

const UA = {
  gpt: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot',
  claude: 'compatible; ClaudeBot/1.0; +claudebot@anthropic.com',
  claudeUser: 'compatible; Claude-User/1.0; +Claude-User@anthropic.com',
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

// ---------------------------------------------------------------- tiny test kit
let passed = 0;
const failures = [];
let current = '';
const section = (name) => { current = name; console.log(`\n== ${name}`); };
const check = (ok, label, detail = '') => {
  if (ok) { passed++; return; }
  failures.push(`${current}: ${label}${detail ? ` (${detail})` : ''}`);
  console.log(`  FAIL ${label}${detail ? ` (${detail})` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, ms, label) {
  const end = Date.now() + ms;
  for (;;) {
    try { const v = await fn(); if (v) return v; } catch { /* keep waiting */ }
    if (Date.now() > end) throw new Error(`timed out waiting for ${label}`);
    await sleep(250);
  }
}

// ---------------------------------------------------------------- process management
const children = [];
function start(cmd, args, { cwd = ROOT, env = {}, name } = {}) {
  const proc = spawn(cmd, args, { cwd, env: { ...process.env, ...env, WRANGLER_SEND_METRICS: 'false', CI: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  proc.output = '';
  proc.stdout.on('data', (d) => { proc.output += d; });
  proc.stderr.on('data', (d) => { proc.output += d; });
  proc.label = name || path.basename(cmd);
  children.push(proc);
  return proc;
}
const stop = (proc) => new Promise((resolve) => {
  if (proc.exitCode !== null || proc.signalCode !== null) return resolve();
  proc.once('exit', resolve);
  proc.kill('SIGTERM');
  setTimeout(() => proc.kill('SIGKILL'), 3000).unref();
});
let persist = '';
async function cleanup() {
  await Promise.all(children.map(stop));
  if (persist) rmSync(persist, { recursive: true, force: true });
}
process.on('SIGINT', async () => { await cleanup(); process.exit(130); });

// ---------------------------------------------------------------- wire recorder
const wire = [];
function startProxy() {
  return createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    wire.push({ url: req.url, auth: req.headers.authorization, body: body.toString() });
    try {
      const r = await fetch(T + req.url, { method: req.method, headers: { authorization: req.headers.authorization ?? '', 'content-type': req.headers['content-type'] ?? '' }, body: req.method === 'GET' ? undefined : body });
      res.statusCode = r.status;
      res.setHeader('content-type', r.headers.get('content-type') ?? 'application/json');
      res.end(await r.text());
    } catch { res.statusCode = 502; res.end(); }
  }).listen(PORT.proxy, '127.0.0.1');
}
const parse = (w) => { try { const b = JSON.parse(w.body); return b.events ?? [b]; } catch { return []; } };
const wireFor = (marker) => wire.filter((w) => parse(w).some((e) => String(e.path).startsWith(marker)));
const wireEvents = (marker) => wireFor(marker).flatMap(parse).filter((e) => String(e.path).startsWith(marker));
const ALLOWED_KEYS = new Set(['site', 'ip', 'ua', 'path', 'method', 'status', 'referer', 'country', 'asn', 'asOrg']);

// ---------------------------------------------------------------- tracker helpers
const api = (p, { method, json, cookie, headers = {}, body } = {}) => fetch(T + p, {
  method: method ?? (json !== undefined || body !== undefined ? 'POST' : 'GET'),
  headers: { ...(json !== undefined ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers },
  body: body ?? (json !== undefined ? JSON.stringify(json) : undefined),
});
const PASSWORD = 'e2e-password-123';
async function signup(email) {
  const res = await api('/api/auth/signup', { json: { email, password: PASSWORD } });
  if (res.status !== 201) throw new Error(`signup ${email}: ${res.status} ${await res.text()}`);
  return res.headers.get('set-cookie').split(';')[0];
}
const ingest = (key, payload) => api('/api/ingest', { json: payload, headers: { authorization: `Bearer ${key}` } });
const readAll = async (readKey, qs = 'range=24h&ai=0') => (await (await api(`/api/v1/export.json?${qs}`, { headers: { authorization: `Bearer ${readKey}` } })).json()).visits;

async function startTracker() {
  persist = mkdtempSync(path.join(tmpdir(), 'abt-e2e-'));
  execFileSync(WRANGLER, ['d1', 'migrations', 'apply', 'ai-bot-tracker', '--local', '--persist-to', persist], { cwd: WORKER, stdio: 'pipe', env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' } });
  const proc = start(WRANGLER, ['dev', '--port', String(PORT.tracker), '--ip', '127.0.0.1', '--persist-to', persist, '--test-scheduled'], { cwd: WORKER, name: 'tracker' });
  await waitFor(async () => (await fetch(`${T}/api/health`)).ok, 90000, 'the tracker to start').catch((e) => { throw new Error(`${e.message}\n${proc.output.slice(-1500)}`); });
}

/** An address inside a vendor CIDR (IPv4 or IPv6). */
function ipInside(cidr) {
  const [addr, len] = cidr.split('/');
  if (addr.includes(':')) return addr.replace(/::$/, '::5').replace(/:$/, ':5');
  const o = addr.split('.').map(Number);
  if (Number(len) <= 30) o[3] = Math.min(255, o[3] + 5);
  return o.join('.');
}
async function vendorPrefix(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { 'user-agent': 'abt-e2e/1.0' } });
    const p = (await res.json()).prefixes[0];
    return p.ipv4Prefix || p.ipv6Prefix;
  } catch { return null; }
}

// ================================================================ main
const registry = JSON.parse(readFileSync(path.join(ROOT, 'signatures/ai-bots.json'), 'utf8')).bots;
const fixtures = JSON.parse(readFileSync(path.join(ROOT, 'signatures/fixtures.json'), 'utf8')).cases;
const hasRanges = new Set(registry.filter((b) => b.ipSources.length).map((b) => b.id));

let siteKey, readKey, cookieA;
let rangesLoaded = false;

async function trackerSection() {
  section('tracker: account, site, keys');
  cookieA = await signup('e2e-a@example.com');
  const site = await (await api('/api/sites', { json: { hostname: 'shop.example.com' }, cookie: cookieA })).json();
  siteKey = site.key;
  check(/^abt_[A-Za-z0-9_-]{43}$/.test(siteKey), 'site creation returns an abt_ key');
  const minted = await (await api('/api/keys', { json: { name: 'e2e reader', kind: 'read' }, cookie: cookieA })).json();
  readKey = minted.key;
  check(/^abtr_[A-Za-z0-9_-]{43}$/.test(readKey), 'read key minted');

  section('tracker: vendor IP ranges (live URLs, via the real cron job)');
  const gpt = await vendorPrefix('https://openai.com/gptbot.json');
  if (!gpt) console.log('  SKIP offline: vendor ranges not reachable');
  else {
    await fetch(`${T}/cdn-cgi/handler/scheduled?cron=17+3+*+*+*`).catch(() => {});
    const probe = async (ip) => { const r = await ingest(siteKey, { ua: UA.gpt, ip, path: `/ranges/${Math.random()}` }); return r.status; };
    await waitFor(async () => {
      await probe(ipInside(gpt));
      const rows = (await readAll(readKey, 'range=24h&ai=0')).filter((v) => v.path.startsWith('/ranges/') && v.ip === ipInside(gpt));
      return rows.some((r) => r.verified === 'verified');
    }, 60000, 'the cron job to load vendor ranges').then(() => { rangesLoaded = true; }).catch(() => {});
    check(rangesLoaded, 'cron loaded vendor ranges and a GPTBot visit from an OpenAI address is verified');
  }

  section('tracker: every bot in the registry is classified correctly');
  const events = fixtures.map((f, i) => ({ ua: f.ua, ip: '203.0.113.50', path: `/fx/${i}`, method: 'GET', status: 200 }));
  let stored = 0, ignored = 0;
  for (let i = 0; i < events.length; i += 20) {
    const body = await (await ingest(siteKey, { events: events.slice(i, i + 20) })).json();
    stored += body.stored; ignored += body.ignored;
  }
  const expected = fixtures.filter((f) => f.expect).length;
  check(stored === expected, `stored ${expected} bots`, `stored=${stored}`);
  check(ignored === fixtures.length - expected, 'ignored the people and unknown browsers', `ignored=${ignored}`);
  const byPath = Object.fromEntries((await readAll(readKey)).filter((v) => v.path.startsWith('/fx/')).map((v) => [v.path, v]));
  fixtures.forEach((f, i) => {
    const row = byPath[`/fx/${i}`];
    if (!f.expect) return check(!row, `no row for non-bot fixture ${i} (${f.ua.slice(0, 30) || 'empty UA'})`);
    check(!!row && row.bot_id === f.expect.id && row.kind === f.expect.kind && row.purpose === f.expect.purpose,
      `${f.expect.id}: ${f.expect.kind}/${f.expect.purpose}`, row ? `got ${row.bot_id} ${row.kind}/${row.purpose}` : 'no row');
    if (row && rangesLoaded) check(row.verified === (hasRanges.has(f.expect.id) ? 'unverified' : 'unknown'),
      `${f.expect.id}: spoofable bots from a documentation IP are unverified, others unknown`, row.verified);
  });

  if (rangesLoaded) {
    section('tracker: verification with real vendor addresses');
    const cases = [
      ['GPTBot, OpenAI IPv4', UA.gpt, ipInside(gpt), 'verified'],
      ['GPTBot, IPv4-mapped IPv6', UA.gpt, `::ffff:${ipInside(gpt)}`, 'verified'],
      ['GPTBot from a random address', UA.gpt, '198.51.100.77', 'unverified'],
    ];
    const g = await vendorPrefix('https://developers.google.com/static/search/apis/ipranges/googlebot.json');
    if (g) cases.push(['Googlebot, Google address', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', ipInside(g), 'verified']);
    const pp = await vendorPrefix('https://www.perplexity.ai/perplexitybot.json');
    if (pp) cases.push(['PerplexityBot, /32 address', 'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)', ipInside(pp), 'verified']);
    cases.push(['ClaudeBot (no published ranges)', UA.claude, '198.51.100.77', 'unknown']);
    for (const [i, [label, ua, ip]] of cases.entries()) await ingest(siteKey, { ua, ip, path: `/verify/${i}` });
    const rows = Object.fromEntries((await readAll(readKey)).filter((v) => v.path.startsWith('/verify/')).map((v) => [v.path, v]));
    cases.forEach(([label, , , want], i) => check(rows[`/verify/${i}`]?.verified === want, `verification: ${label} -> ${want}`, rows[`/verify/${i}`]?.verified));
  }

  section('tracker: security and robustness over real HTTP');
  const noKey = await api('/api/ingest', { json: { ua: UA.gpt, path: '/' } });
  check(noKey.status === 401, 'ingest without a key is 401');
  check((await ingest('abt_' + 'x'.repeat(43), { ua: UA.gpt, path: '/' })).status === 401, 'ingest with a wrong key is 401');
  check((await ingest(readKey, { ua: UA.gpt, path: '/' })).status === 401, 'a read key cannot ingest');
  check((await api('/api/ingest', { headers: { authorization: `Bearer ${siteKey}` } })).status === 405, 'GET /api/ingest is 405');
  check((await api('/api/ingest', { body: '{nope', headers: { authorization: `Bearer ${siteKey}`, 'content-type': 'application/json' } })).status === 400, 'invalid JSON is 400');
  check((await ingest(siteKey, { events: Array.from({ length: 101 }, () => ({ ua: UA.gpt, path: '/x' })) })).status === 400, '101 events in one request is 400');
  check((await api('/api/ingest', { body: JSON.stringify({ ua: UA.gpt, path: '/' + 'a'.repeat(300 * 1024) }), headers: { authorization: `Bearer ${siteKey}`, 'content-type': 'application/json' } })).status === 413, 'a body over 256 KB is 413');

  const hostile = [
    { ua: 'GPTBot <img src=x onerror=alert(1)> ' + 'A'.repeat(5000), path: '/<script>alert(1)</script>?q=1#frag', ip: '203.0.113.60' },
    { ua: "=HYPERLINK(\"http://evil\") crawler/1.0", path: '/=cmd', ip: '203.0.113.61' },
    { ua: "Robot'); DROP TABLE visits;--", path: "/x'; DROP TABLE visits;--", ip: '203.0.113.62' },
    { ua: 'bot', path: '', ip: 'not-an-ip' },
  ];
  const hres = await (await ingest(siteKey, { events: hostile })).json();
  check(hres.stored + hres.ignored + hres.rejected === 4, 'hostile events never crash the tracker', JSON.stringify(hres));
  const rows = await readAll(readKey);
  const xss = rows.find((v) => v.path.startsWith('/<script>'));
  check(!!xss && xss.path === '/<script>alert(1)</script>', 'markup is stored as inert text and the query string is dropped', xss?.path);
  check(!!xss && xss.ua.length <= 512, 'a 5000 character user agent is stored cut to 512', String(xss?.ua.length));
  check((await readAll(readKey)).length > 40, 'visits table survived the SQL injection attempt');
  const csv = await (await api('/api/v1/export.csv?range=24h&ai=0', { headers: { authorization: `Bearer ${readKey}` } })).text();
  check(csv.includes('HYPERLINK') && !/(^|,)"?[=+@-]\w*HYPERLINK/m.test(csv), 'CSV export neutralises spreadsheet formulas');

  const cookieB = await signup('e2e-b@example.com');
  const siteB = await (await api('/api/sites', { json: { hostname: 'other.example.org' }, cookie: cookieB })).json();
  await ingest(siteB.key, { ua: UA.gpt, path: '/secret-b', ip: '203.0.113.70' });
  const readB = (await (await api('/api/keys', { json: { name: 'b', kind: 'read' }, cookie: cookieB })).json()).key;
  const seenByA = await readAll(readKey);
  const seenByB = await readAll(readB);
  check(!seenByA.some((v) => v.path === '/secret-b'), "tenant isolation: user A never sees user B's visits");
  check(seenByB.every((v) => v.path === '/secret-b') && seenByB.length === 1, 'tenant isolation: user B sees only their own visit', String(seenByB.length));
  check((await api(`/api/summary?range=7d&site=${site.site.id}`, { cookie: cookieB })).status === 404, "user B cannot query user A's site");
  check((await api('/api/auth/signup', { json: { email: 'e2e-x@example.com', password: PASSWORD }, headers: { origin: 'https://evil.example' } })).status === 403, 'cross-site POST is rejected (CSRF)');
  check((await api('/api/summary?range=7d')).status === 401, 'dashboard API needs a session');

  section('tracker: dashboard API agrees with what was ingested');
  const summary = await (await api('/api/summary?range=24h&ai=0', { cookie: cookieA })).json();
  const total = (await readAll(readKey)).length;
  check(summary.hits === total, 'summary hits equal exported visits', `${summary.hits} vs ${total}`);
  check(summary.byPurpose.training > 0 && summary.byPurpose.retrieval > 0 && summary.byPurpose.indexing > 0, 'all three purposes are present');
}

// ---------------------------------------------------------------- integrations
const APPS_BY_NAME = {
  node: (env) => start('node', [path.join(APPS, 'node_app.js')], { env, name: 'node app' }),
  flask: (env) => start(PY, [path.join(APPS, 'flask_app.py')], { env, name: 'flask app' }),
  django: (env) => start(PY, [path.join(APPS, 'django_app.py')], { env, name: 'django app' }),
  php: (env) => start('php', ['-S', `127.0.0.1:${env.PORT}`, path.join(APPS, 'php_app.php')], { env, name: 'php app' }),
};

async function integration(name) {
  section(`integration: ${name} middleware -> tracker`);
  const base = (port) => `http://127.0.0.1:${port}`;
  const env = (port, tracker) => ({ PORT: String(port), TRACKER_URL: tracker, TRACKER_KEY: siteKey, SITE: 'shop.example.com' });
  const app = APPS_BY_NAME[name](env(PORT[name], PROXY));
  try {
    await waitFor(async () => (await fetch(`${base(PORT[name])}/ready`, { headers: { 'user-agent': UA.chrome } })).status > 0, 30000, `${name} app`)
      .catch((e) => { throw new Error(`${e.message}\n${app.output.slice(-1200)}`); });
    const get = async (p, ua, extra = {}) => { const r = await fetch(base(PORT[name]) + p, { headers: { 'user-agent': ua, ...extra } }); return { status: r.status, body: await r.text() }; };
    const p = `/${name}`;
    const human = await get(`${p}/pricing`, UA.chrome);
    const bot = await get(`${p}/pricing?utm=x&token=secret`, UA.gpt, { referer: 'https://news.example/post?id=7&sid=refsecret', cookie: 'session=cookiesecret', authorization: 'Bearer authsecret' });
    const missing = await get(`${p}/missing`, UA.claude);
    const retrieval = await get(`${p}/about`, UA.claudeUser);
    await get(`${p}/home`, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 [LinkedInApp]');

    check(bot.status === 200 && bot.body === human.body, 'a bot gets exactly the same page as a person');
    check(missing.status === 404 && missing.body === 'not found', 'a 404 stays a 404');
    check(retrieval.status === 200, 'the app keeps working for every request');

    const rows = await waitFor(async () => {
      const r = (await readAll(readKey)).filter((v) => v.path.startsWith(`${p}/`));
      return r.length >= 3 ? r : null;
    }, 15000, `${name} visits to arrive at the tracker`).catch(() => (null));
    const mine = rows || (await readAll(readKey)).filter((v) => v.path.startsWith(`${p}/`));
    check(mine.length === 3, 'exactly the 3 bot visits arrive (no humans)', `got ${mine.length}: ${mine.map((v) => v.path)}`);
    const row = (suffix) => mine.find((v) => v.path === `${p}/${suffix}`);
    const g = row('pricing'), c = row('missing'), u = row('about');
    check(g?.bot_id === 'gptbot' && g.purpose === 'training' && g.method === 'GET' && g.status === 200, 'GPTBot: training, GET, 200', JSON.stringify(g && [g.bot_id, g.purpose, g.method, g.status]));
    check(!!g && !g.path.includes('?') && !JSON.stringify(g).includes('secret'), 'nothing secret is stored');
    check(!g || !g.referer || !g.referer.includes('?'), 'referer is stored without its query', g?.referer);

    // what actually left the server (recorded between the app and the tracker)
    const sentEvents = wireEvents(`${p}/`);
    const sentBodies = wireFor(`${p}/`);
    check(sentEvents.length === 3, 'exactly 3 events were sent over the network', String(sentEvents.length));
    check(sentBodies.length > 0 && sentBodies.every((w) => w.auth === `Bearer ${siteKey}` && w.url === '/api/ingest'), 'sent to /api/ingest with the site key');
    check(sentEvents.every((e) => !String(e.path).includes('?') && !String(e.path).includes('#')), 'on the wire: paths carry no query string', sentEvents.map((e) => e.path).join());
    check(!sentBodies.some((w) => /secret/i.test(w.body)), 'on the wire: no query value, cookie or authorization value is ever sent');
    check(sentEvents.every((e) => !e.referer || !String(e.referer).includes('?')), 'on the wire: referers carry no query string', sentEvents.map((e) => e.referer).join());
    check(sentEvents.every((e) => Object.keys(e).every((k) => ALLOWED_KEYS.has(k))), 'on the wire: only the documented fields are sent (no headers)', [...new Set(sentEvents.flatMap(Object.keys))].join());
    check(c?.bot_id === 'claudebot' && c.status === 404, 'ClaudeBot: the real 404 status is reported', JSON.stringify(c && [c.bot_id, c.status]));
    check(u?.bot_id === 'claude-user' && u.purpose === 'retrieval', 'Claude-User: retrieval', u?.purpose);
    check(mine.every((v) => /127\.0\.0\.1|::1/.test(v.ip || '')), 'client IP is recorded', mine.map((v) => v.ip).join());
    check(!(await readAll(readKey)).some((v) => /Chrome|LinkedIn/.test(v.ua || '') && v.path.startsWith(p)), 'no person or in-app browser was ever reported');

    // fail open: the tracker is unreachable, the visitor must still get a normal, fast page
    const port2 = PORT[name] + 100;
    const dead = APPS_BY_NAME[name](env(port2, `http://127.0.0.1:${PORT.dead}`));
    try {
      await waitFor(async () => (await fetch(`${base(port2)}/ready`)).status > 0, 30000, `${name} app (dead tracker)`);
      const t0 = Date.now();
      const r = await fetch(`${base(port2)}${p}/pricing`, { headers: { 'user-agent': UA.gpt } });
      const body = await r.text();
      check(r.status === 200 && body === `ok ${p}/pricing`, 'tracker down: the page is still served normally');
      check(Date.now() - t0 < 2500, 'tracker down: the visitor is not made to wait', `${Date.now() - t0} ms`);
    } finally { await stop(dead); }
  } finally { await stop(app); }
}

// ---------------------------------------------------------------- edge sensor (real sensor logic, real HTTP to the tracker)
async function sensorSection() {
  section('integration: edge sensor -> tracker');
  const seen = [];
  const origin = createServer((req, res) => {
    seen.push(req.url);
    res.statusCode = req.url.includes('/gone') ? 410 : 200;
    res.setHeader('x-origin', 'yes');
    res.setHeader('content-type', 'text/plain');
    res.end(`origin ${req.url}`);
  }).listen(PORT.origin, '127.0.0.1');
  const proc = start(WRANGLER, ['dev', '-c', path.join(APPS, 'sensor_wrapper/wrangler.jsonc'), '--port', String(PORT.sensor), '--ip', '127.0.0.1',
    '--var', `TRACKER_URL:${PROXY}`, '--var', `TRACKER_KEY:${siteKey}`, '--var', `ORIGIN:http://127.0.0.1:${PORT.origin}`], { cwd: WORKER, name: 'sensor' });
  try {
    const S = `http://127.0.0.1:${PORT.sensor}`;
    await waitFor(async () => (await fetch(`${S}/ready`)).status > 0, 60000, 'the sensor to start').catch((e) => { throw new Error(`${e.message}\n${proc.output.slice(-1200)}`); });
    const get = async (p, ua, headers = {}) => { const r = await fetch(S + p, { headers: { 'user-agent': ua, ...headers } }); return { status: r.status, body: await r.text(), origin: r.headers.get('x-origin') }; };
    const human = await get('/sensor/pricing', UA.chrome);
    const bot = await get('/sensor/pricing?utm=1', UA.gpt, { referer: 'https://news.example/post?id=7&sid=refsecret' });
    check(true, 'sensor request sent');
    const gone = await get('/sensor/gone', UA.claude);
    const deadTracker = await get('/sensor/safe', UA.gpt, { 'x-e2e-tracker': `http://127.0.0.1:${PORT.dead}` });
    const badKey = await get('/sensor/badkey', UA.gpt, { 'x-e2e-key': 'abt_' + 'z'.repeat(43) });
    check(human.status === 200 && human.origin === 'yes' && human.body === 'origin /sensor/pricing', 'a person gets the origin response untouched');
    check(bot.status === 200 && bot.origin === 'yes' && bot.body === 'origin /sensor/pricing?utm=1', 'a bot gets the origin response untouched');
    check(gone.status === 410, 'origin status codes pass through (410)');
    check(deadTracker.status === 200 && deadTracker.body === 'origin /sensor/safe', 'tracker unreachable: sensor still returns the origin response');
    check(badKey.status === 200, 'tracker rejects the key: sensor still returns the origin response');
    check(seen.length === 5, 'the origin saw every request exactly once', String(seen.length));
    const rows = await waitFor(async () => {
      const r = (await readAll(readKey)).filter((v) => v.path.startsWith('/sensor/'));
      return r.length >= 2 ? r : null;
    }, 15000, 'sensor reports to arrive');
    const paths = rows.map((v) => v.path).sort();
    check(JSON.stringify(paths) === JSON.stringify(['/sensor/gone', '/sensor/pricing']), 'only the two reportable bot visits were recorded', paths.join());
    check(rows.find((v) => v.path === '/sensor/gone')?.status === 410, 'the real origin status (410) is what gets reported');
    check(!rows.some((v) => /Chrome/.test(v.ua)), 'people are never recorded by the sensor');
    check(!wireFor('/sensor/').some((w) => /secret/i.test(w.body)), 'on the wire: the sensor never sends a query value from the referer');
    const sent = wireEvents('/sensor/');
    check(sent.length === 3 && sent.every((e) => !String(e.path).includes('?') && Object.keys(e).every((k) => ALLOWED_KEYS.has(k))), 'on the wire: the sensor sends clean events (pricing, gone and the bad-key probe)', JSON.stringify(sent));
  } finally { await stop(proc); origin.close(); }
}

try {
  if (want('tracker') || want('node') || want('flask') || want('django') || want('php') || want('sensor')) {
    console.log('starting tracker (wrangler dev, fresh local D1)...');
    await startTracker();
    children.push({ exitCode: null, signalCode: null, once: (_e, f) => f(), kill: () => proxy.close() });
    const proxy = startProxy();
    if (!siteKey) await trackerSection();
    for (const name of ['node', 'flask', 'django', 'php']) if (want(name)) await integration(name);
    if (want('sensor')) await sensorSection();
  }
} catch (err) {
  failures.push(`${current}: crashed: ${err.stack || err}`);
  console.error(err);
} finally {
  await cleanup();
}

console.log(`\n${passed} checks passed, ${failures.length} failed`);
if (failures.length) { console.log('\nFAILURES:\n- ' + failures.join('\n- ')); process.exit(1); }
