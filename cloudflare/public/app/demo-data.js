// Deterministic sample data for the public demo. Returns the same JSON shapes as /api/*.
const SPANS = { "24h": 86400, "7d": 7 * 86400, "30d": 30 * 86400, "90d": 90 * 86400 };
const SITES = [{ id: 1, hostname: "example.com" }, { id: 2, hostname: "docs.example.com" }];
const BOTS = [
  ["gptbot", "GPTBot", "OpenAI", "ai", "training", 26], ["chatgpt-user", "ChatGPT-User", "OpenAI", "ai", "retrieval", 14],
  ["oai-searchbot", "OAI-SearchBot", "OpenAI", "ai", "indexing", 9], ["claudebot", "ClaudeBot", "Anthropic", "ai", "training", 15],
  ["claude-user", "Claude-User", "Anthropic", "ai", "retrieval", 7], ["claude-searchbot", "Claude-SearchBot", "Anthropic", "ai", "indexing", 4],
  ["perplexitybot", "PerplexityBot", "Perplexity", "ai", "indexing", 7], ["perplexity-user", "Perplexity-User", "Perplexity", "ai", "retrieval", 4],
  ["bytespider", "Bytespider", "ByteDance", "ai", "training", 10], ["amazonbot", "Amazonbot", "Amazon", "ai", "training", 8],
  ["meta-externalagent", "Meta-ExternalAgent", "Meta", "ai", "training", 6], ["applebot", "Applebot", "Apple", "ai", "indexing", 3],
  ["ccbot", "CCBot", "Common Crawl", "ai", "training", 4], ["googlebot", "Googlebot", "Google", "search", "indexing", 14],
].map(([id, name, operator, kind, purpose, w]) => ({ id, name, operator, kind, purpose, w }));
const PAGES = ["/", "/blog/edge-caching-guide", "/blog/d1-vs-kv", "/pricing", "/docs/getting-started", "/docs/api", "/blog/bot-traffic-2026", "/about", "/changelog", "/robots.txt", "/sitemap.xml", "/blog/workers-cron", "/docs/errors"];
const COUNTRIES = ["US", "US", "US", "IE", "SG", "DE", "JP"];

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

let cache = null;
function build() {
  const now = Math.floor(Date.now() / 1000), day = Math.floor(now / 86400);
  if (cache && cache.day === day) return cache;
  const r = rng(20261114), hourly = [], recent = [];
  const startHour = Math.floor(now / 3600) * 3600 - 89 * 86400;
  for (let hour = startHour; hour <= now; hour += 3600) {
    const age = (now - hour) / 86400, dow = new Date(hour * 1000).getUTCDay(), hod = new Date(hour * 1000).getUTCHours();
    const growth = 0.55 + 0.45 * (1 - age / 90), daily = 0.85 + 0.3 * Math.sin((hod / 24) * Math.PI * 2 - 1) + (dow === 0 || dow === 6 ? -0.1 : 0.05);
    for (const site of SITES) for (const b of BOTS) {
      const n = Math.round(Math.max(0, b.w * growth * daily * (site.id === 1 ? 0.2 : 0.07) * (0.4 + r() * 1.2)));
      if (!n) continue;
      const spoof = b.id === "gptbot" ? 0.22 : 0.12;
      const unverified = Math.round(n * spoof * (r() < 0.6 ? 1 : 0.4));
      const ranged = ["gptbot", "chatgpt-user", "oai-searchbot", "perplexitybot", "perplexity-user", "applebot", "googlebot"].includes(b.id);
      if (ranged) { hourly.push({ hour, site: site.id, bot: b, verified: "verified", hits: n - unverified }); if (unverified) hourly.push({ hour, site: site.id, bot: b, verified: "unverified", hits: unverified }); }
      else hourly.push({ hour, site: site.id, bot: b, verified: "unknown", hits: n });
    }
  }
  for (let i = 0; i < 60; i++) {
    const b = BOTS[Math.floor(r() * BOTS.length)], site = SITES[r() < 0.8 ? 0 : 1];
    recent.push({ id: i, ts: now - Math.floor(i * 410 + r() * 300), site: site.hostname, bot_id: b.id, bot_name: b.name, operator: b.operator, kind: b.kind, purpose: b.purpose,
      verified: r() < 0.7 ? "verified" : r() < 0.5 ? "unverified" : "unknown", path: PAGES[Math.floor(Math.pow(r(), 1.7) * PAGES.length)], status: r() < 0.93 ? 200 : r() < 0.5 ? 404 : 301, country: COUNTRIES[Math.floor(r() * COUNTRIES.length)] });
  }
  cache = { day, now, hourly, recent };
  return cache;
}

function windowOf(state) {
  const span = SPANS[state.range] ?? SPANS["7d"], bucket = state.range === "24h" ? 3600 : 86400;
  const to = Math.floor(Date.now() / 1000 / bucket) * bucket + bucket;
  return { span, bucket, to, from: to - span };
}
const pick = (rows, state, from, to) => rows.filter((x) => x.hour >= from && x.hour < to && (!state.ai || x.bot.kind === "ai") && (state.site === "all" || String(x.site) === state.site));
const sum = (rows) => rows.reduce((a, x) => a + x.hits, 0);

export async function demoApi(path, state) {
  const { hourly, recent } = build();
  const w = windowOf(state), cur = pick(hourly, state, w.from, w.to);
  if (path === "/api/summary") {
    const prev = sum(pick(hourly, state, w.from - w.span, w.from)), h = sum(cur);
    const by = { training: 0, indexing: 0, retrieval: 0, unknown: 0 }, v = { verified: 0, unverified: 0 };
    for (const x of cur) { by[x.bot.purpose] += x.hits; if (x.verified in v) v[x.verified] += x.hits; }
    const checked = v.verified + v.unverified;
    return { range: state.range, from: w.from, to: w.to, hits: h, prevHits: prev, delta: prev ? Math.round(((h - prev) / prev) * 1000) / 10 : null,
      bots: new Set(cur.map((x) => x.bot.id)).size, pages: Math.min(PAGES.length, Math.max(3, Math.round(PAGES.length * Math.min(1, h / 400)))), byPurpose: by,
      verifiedPct: checked ? Math.round((v.verified / checked) * 1000) / 10 : null, unverified: v.unverified, sites: SITES };
  }
  if (path === "/api/timeseries") {
    const n = w.span / w.bucket, points = Array.from({ length: n }, (_, i) => ({ t: w.from + i * w.bucket, training: 0, indexing: 0, retrieval: 0, unknown: 0 }));
    for (const x of cur) points[Math.floor((x.hour - w.from) / w.bucket)][x.bot.purpose] += x.hits;
    return { range: state.range, bucket: w.bucket, points };
  }
  if (path === "/api/bots") {
    const m = new Map();
    for (const x of cur) { const e = m.get(x.bot.id) ?? { id: x.bot.id, name: x.bot.name, operator: x.bot.operator, kind: x.bot.kind, purpose: x.bot.purpose, hits: 0, verified: 0, unverified: 0 }; e.hits += x.hits; if (x.verified === "verified") e.verified += x.hits; if (x.verified === "unverified") e.unverified += x.hits; m.set(x.bot.id, e); }
    return { bots: [...m.values()].sort((a, b) => b.hits - a.hits).slice(0, 25) };
  }
  if (path === "/api/pages") {
    const total = sum(cur), r = rng(7), weights = PAGES.map((_, i) => 14 - i);
    const ws = weights.reduce((a, b) => a + b, 0);
    return { pages: PAGES.map((p, i) => { const hits = Math.round((total * weights[i]) / ws); const t = Math.round(hits * (0.5 + r() * 0.1)), ix = Math.round(hits * 0.2); return { path: p, hits, bots: Math.max(1, Math.min(14, Math.round(hits / 20))), training: t, indexing: ix, retrieval: hits - t - ix }; }).filter((p) => p.hits > 0).slice(0, 20) };
  }
  if (path === "/api/heatmap") {
    const m = new Map();
    for (const x of cur) { const d = new Date(x.hour * 1000), k = d.getUTCDay() * 24 + d.getUTCHours(); m.set(k, (m.get(k) ?? 0) + x.hits); }
    return { cells: [...m].map(([k, hits]) => ({ d: Math.floor(k / 24), h: k % 24, hits })) };
  }
  if (path === "/api/recent") return { visits: recent.filter((v) => !state.ai || v.kind === "ai").filter((v) => state.site === "all" || SITES.find((s) => String(s.id) === state.site)?.hostname === v.site).slice(0, 25) };
  if (path === "/api/export.json") return { visits: recent.filter((v) => !state.ai || v.kind === "ai").filter((v) => state.site === "all" || SITES.find((s) => String(s.id) === state.site)?.hostname === v.site) };
  throw new Error(`demo: no data for ${path}`);
}
