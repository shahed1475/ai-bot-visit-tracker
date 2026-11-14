#!/usr/bin/env node
/** Node.js core + middleware tests. Run: node --test tests/test_nodejs_middleware.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { EventEmitter } = require('node:events');

const BotDetector = require('../core/bot-detector');
const RequestClassifier = require('../core/classifier');
const { inRanges } = require('../core/cidr');
const { Reporter } = require('../core/reporter');
const { AiBotTracker } = require('../middleware/nodejs');
const fixtures = require('../signatures/fixtures.json');

const GPT = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot';
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

test('detector matches every shared fixture', () => {
  const d = new BotDetector();
  for (const c of fixtures.cases) {
    const r = d.detectBot(c.ua, '203.0.113.9');
    if (c.expect === null) { assert.equal(r.isBot, false, c.ua); continue; }
    assert.equal(r.isBot, true, c.ua);
    assert.equal(r.botId, c.expect.id, c.ua);
    assert.equal(r.kind, c.expect.kind);
    assert.equal(r.purpose, c.expect.purpose);
  }
});

test('detector: humans are not bots, falsy UA is safe, generic fallback works', () => {
  const d = new BotDetector();
  assert.equal(d.detectBot(CHROME, '1.1.1.1').isBot, false);
  assert.equal(d.detectBot(undefined, '1.1.1.1').isBot, false);
  assert.equal(d.detectBot('x'.repeat(100000), '1.1.1.1').isBot, false);
  const g = d.detectBot('Mozilla/5.0 (compatible; FooBarBot/1.0)', '1.1.1.1');
  assert.deepEqual([g.isBot, g.botId, g.kind], [true, 'generic-bot', 'other']);
});

test('detector verifies IPs against vendor ranges', () => {
  const d = new BotDetector({ ipRanges: { gptbot: ['20.15.240.64/26'] } });
  assert.equal(d.detectBot(GPT, '20.15.240.70').verified, 'verified');
  assert.equal(d.detectBot(GPT, '8.8.8.8').verified, 'unverified');
  assert.equal(d.detectBot('compatible; ClaudeBot/1.0', '8.8.8.8').verified, 'unknown');
});

test('cidr handles v4, v6, mapped v6 and garbage', () => {
  assert.equal(inRanges('20.15.240.127', ['20.15.240.64/26']), true);
  assert.equal(inRanges('20.15.240.128', ['20.15.240.64/26']), false);
  assert.equal(inRanges('2001:4860:4801:10::5', ['2001:4860:4801:10::/64']), true);
  assert.equal(inRanges('::ffff:20.15.240.70', ['20.15.240.64/26']), true);
  for (const bad of ['', 'nope', '999.1.1.1', '1.2.3']) assert.equal(inRanges(bad, ['1.2.3.0/24']), false);
});

test('classifier trusts the declared purpose, falls back to heuristics', () => {
  const c = new RequestClassifier();
  const r = c.classifyRequest({ userAgent: 'Claude-User', headers: {}, url: '/a', ipAddress: '1.1.1.1', purpose: 'retrieval', botName: 'Claude-User' });
  assert.equal(r.classification, 'retrieval');
  assert.ok(r.confidence >= 0.9);
  const t = c.classifyRequest({ userAgent: 'GPTBot', headers: {}, url: '/a', ipAddress: '1.1.1.1', purpose: 'training' });
  assert.equal(t.classification, 'training');
  const u = c.classifyRequest({ userAgent: 'x', headers: {}, url: '/a', ipAddress: '2.2.2.2', purpose: 'unknown' });
  assert.ok(['unknown', 'indexing', 'retrieval'].includes(u.classification));
});

function fakeRes() { const r = new EventEmitter(); r.statusCode = 200; r.headers = {}; r.setHeader = (k, v) => { r.headers[k] = v; }; return r; }
function fakeReq(ua, extra = {}) {
  const headers = { 'user-agent': ua, host: 'site.test', cookie: 'secret=1', ...extra };
  return { ip: '203.0.113.7', protocol: 'https', originalUrl: '/blog/post?token=abc', method: 'GET', headers,
    get: (n) => headers[n.toLowerCase()], connection: {}, socket: {} };
}
const tmpDb = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'abt-')), 'v.db');
const run = async (mw, req, res) => { let called = false; await mw(req, res, () => { called = true; }); return called; };
const settle = (ms = 80) => new Promise((r) => setTimeout(r, ms));

test('middleware logs bot visits (sanitised, with status) and ignores humans', async () => {
  const t = new AiBotTracker({ database: { type: 'sqlite', path: tmpDb() }, enableLogging: false, asyncLogging: false });
  const mw = t.middleware();
  const res = fakeRes(); res.statusCode = 404;
  const req = fakeReq(GPT);
  assert.equal(await run(mw, req, res), true);
  assert.equal(req.botInfo.botId, 'gptbot');
  res.emit('finish');
  await settle();
  const human = fakeRes();
  assert.equal(await run(mw, fakeReq(CHROME), human), true);
  human.emit('finish');
  await settle();
  const rows = await t.getRecentVisits(10);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].bot_name, 'GPTBot');
  assert.equal(rows[0].classification, 'training');
  assert.equal(rows[0].response_status, 404);
  assert.ok(!/secret/.test(rows[0].headers), 'cookie header must not be stored');
  assert.equal(rows[0].page_url, 'https://site.test/blog/post', 'query string must not be stored');
  const stats = await t.getStats();
  assert.equal(stats[0].bot_name, 'GPTBot');
  assert.equal(stats[0].total_visits, 1);
  await t.close();
});

test('middleware never blocks or fails the request when reporting fails', async () => {
  const t = new AiBotTracker({ database: false, enableLogging: false, report: { endpoint: 'http://127.0.0.1:1', key: 'k', site: 's.test', timeoutMs: 300 } });
  const res = fakeRes();
  assert.equal(await run(t.middleware(), fakeReq(GPT), res), true);
  res.emit('finish');
  await settle(400);
  await t.close();
});

test('reporter posts a batch with bearer auth and the tracker event shape', async () => {
  let got;
  const server = http.createServer((req, res) => {
    let body = ''; req.on('data', (c) => (body += c));
    req.on('end', () => { got = { auth: req.headers.authorization, url: req.url, body: JSON.parse(body) }; res.end('{"stored":1}'); });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const rep = new Reporter({ endpoint: `http://127.0.0.1:${server.address().port}`, key: 'abc', site: 'Example.com', flushMs: 0 });
  await rep.send([{ ip: '1.2.3.4', ua: GPT, path: '/x?y=1', method: 'GET', status: 200 }]);
  server.close();
  assert.equal(got.url, '/api/ingest');
  assert.equal(got.auth, 'Bearer abc');
  assert.deepEqual(Object.keys(got.body.events[0]).sort(), ['ip', 'method', 'path', 'site', 'status', 'ua']);
  assert.equal(got.body.events[0].site, 'Example.com');
});

test('reporter.send resolves false (never throws) on network failure', async () => {
  const rep = new Reporter({ endpoint: 'http://127.0.0.1:1', key: 'k', site: 's', timeoutMs: 300, flushMs: 0 });
  assert.equal(await rep.send([{ ua: GPT, path: '/' }]), false);
});
