// Seeds a running tracker with realistic fake bot traffic.
// Usage: node scripts/seed.mjs [baseUrl=http://localhost:8787] [count=2500] [email=demo@example.com] [password=demo-password-123]
// Creates (or logs in) the user, adds two sites, and ingests fake visits with each site's key.
import { readFileSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:8787";
const count = Number(process.argv[3] ?? 2500);
const email = process.argv[4] ?? "demo@example.com";
const password = process.argv[5] ?? "demo-password-123";
const post = (path, body, cookie) => fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
let res = await post("/api/auth/signup", { email, password });
if (res.status === 409) res = await post("/api/auth/login", { email, password });
if (!res.ok) throw new Error(`auth failed: ${res.status} ${await res.text()}`);
const cookie = res.headers.get("set-cookie").split(";")[0];
const keys = {};
for (const hostname of ["example.com", "docs.example.com"]) {
  const r = await post("/api/sites", { hostname }, cookie);
  if (r.status === 201) keys[hostname] = (await r.json()).key;
  else if (r.status !== 409) throw new Error(`site failed: ${r.status}`);
}
if (!Object.keys(keys).length) { console.log("sites already exist (keys are shown once); rotate a key in the app to seed again"); process.exit(0); }

const fixtures = JSON.parse(readFileSync(new URL("../../signatures/fixtures.json", import.meta.url), "utf8")).cases;
const uaOf = Object.fromEntries(fixtures.filter((c) => c.expect).map((c) => [c.expect.id, c.ua]));
const WEIGHTS = { gptbot: 26, "chatgpt-user": 12, claudebot: 14, "claude-user": 6, "claude-searchbot": 4, "oai-searchbot": 9, perplexitybot: 6,
  "perplexity-user": 3, bytespider: 10, amazonbot: 8, ccbot: 4, "meta-externalagent": 6, applebot: 3, googlebot: 14, bingbot: 7,
  "google-cloudvertexbot": 2, duckassistbot: 2 };
const PAGES = ["/", "/blog/edge-caching-guide", "/blog/d1-vs-kv", "/pricing", "/docs/getting-started", "/docs/api", "/blog/bot-traffic-2026", "/about", "/changelog", "/robots.txt", "/sitemap.xml", "/blog/workers-cron", "/docs/errors"];

const pick = (list, weights) => { let r = Math.random() * weights.reduce((a, b) => a + b, 0); for (let i = 0; i < list.length; i++) if ((r -= weights[i]) < 0) return list[i]; return list.at(-1); };
const ids = Object.keys(WEIGHTS);
const randIp = () => Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 254)).join(".");

let openai = [];
try {
  const j = await (await fetch("https://openai.com/gptbot.json")).json();
  openai = j.prefixes.map((p) => p.ipv4Prefix).filter(Boolean);
} catch { /* offline: no verified samples */ }
const ipInPrefix = (cidr) => { const [a, l] = cidr.split("/"); const o = a.split(".").map(Number); const host = 32 - Number(l); const n = ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0; const ip = (n + Math.floor(Math.random() * 2 ** host)) >>> 0; return [ip >>> 24, (ip >>> 16) & 255, (ip >>> 8) & 255, ip & 255].join("."); };

const now = Math.floor(Date.now() / 1000);
const events = Array.from({ length: count }, () => {
  const id = pick(ids, ids.map((i) => WEIGHTS[i]));
  const daysAgo = Math.floor(Math.pow(Math.random(), 1.6) * 30);
  const hour = Math.floor(((Math.sin(Math.random() * Math.PI) + Math.random()) / 2) * 24);
  const ts = Math.min(now - 30, now - daysAgo * 86400 - (now % 86400) + hour * 3600 + Math.floor(Math.random() * 3600));
  const ip = id === "gptbot" && openai.length && Math.random() < 0.8 ? ipInPrefix(pick(openai, openai.map(() => 1))) : randIp();
  return { ts, site: Math.random() < 0.8 ? "example.com" : "docs.example.com", ip, ua: uaOf[id], path: pick(PAGES, PAGES.map((_, i) => 14 - i)),
    method: "GET", status: Math.random() < 0.93 ? 200 : Math.random() < 0.5 ? 404 : 301, country: pick(["US", "IE", "SG", "DE", "JP"], [60, 12, 10, 10, 8]) };
});

let stored = 0;
for (const host of Object.keys(keys)) {
  const mine = events.filter((e) => e.site === host);
  for (let i = 0; i < mine.length; i += 100) {
    const res = await fetch(`${base}/api/ingest`, { method: "POST", headers: { authorization: `Bearer ${keys[host]}`, "content-type": "application/json" }, body: JSON.stringify({ events: mine.slice(i, i + 100) }) });
    if (!res.ok) throw new Error(`ingest failed: ${res.status} ${await res.text()}`);
    stored += (await res.json()).stored;
  }
}
console.log(`seeded ${stored} visits for ${email} (password: ${password}) into ${base}`);
