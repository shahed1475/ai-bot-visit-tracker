import { BOTS } from "./registry";

const SPANS: Record<string, number> = { "24h": 86400, "7d": 7 * 86400, "30d": 30 * 86400, "90d": 90 * 86400 };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
const NAMES = new Map(BOTS.map((b) => [b.id, b]));

interface Win { range: string; span: number; bucket: number; from: number; to: number; ids: number[]; ai: boolean }

function parse(url: URL, ids: number[]): Win | null {
  const range = url.searchParams.get("range") ?? "7d";
  const span = SPANS[range];
  if (!span) return null;
  const bucket = range === "24h" ? 3600 : 86400;
  const to = Math.floor(Date.now() / 1000 / bucket) * bucket + bucket;
  return { range, span, bucket, from: to - span, to, ids: ids.length ? ids : [-1], ai: url.searchParams.get("ai") !== "0" };
}

/** WHERE fragment + binds. col = "hour" (rollup) or "ts" (raw). */
function where(w: Win, col: "hour" | "ts", from = w.from, to = w.to) {
  let sql = `${col} >= ? AND ${col} < ? AND site_id IN (${w.ids.map(() => "?").join(",")})`;
  const binds: (string | number)[] = [from, to, ...w.ids];
  if (w.ai) sql += " AND kind = 'ai'";
  return { sql, binds };
}

const botInfo = (id: string) => {
  const b = NAMES.get(id);
  return b ? { name: b.name, operator: b.operator } : { name: "Other crawler", operator: "Unknown" };
};

async function summary(env: Env, w: Win, sites: { id: number; hostname: string }[]) {
  const cur = where(w, "hour"), prev = where(w, "hour", w.from - w.span, w.from), raw = where(w, "ts");
  const [hits, prevHits, bots, pages, purposes, verif] = await env.DB.batch<any>([
    env.DB.prepare(`SELECT COALESCE(SUM(hits),0) n FROM visit_hourly WHERE ${cur.sql}`).bind(...cur.binds),
    env.DB.prepare(`SELECT COALESCE(SUM(hits),0) n FROM visit_hourly WHERE ${prev.sql}`).bind(...prev.binds),
    env.DB.prepare(`SELECT COUNT(DISTINCT bot_id) n FROM visit_hourly WHERE ${cur.sql}`).bind(...cur.binds),
    env.DB.prepare(`SELECT COUNT(DISTINCT path) n FROM visits WHERE ${raw.sql}`).bind(...raw.binds),
    env.DB.prepare(`SELECT purpose, SUM(hits) n FROM visit_hourly WHERE ${cur.sql} GROUP BY purpose`).bind(...cur.binds),
    env.DB.prepare(`SELECT verified, SUM(hits) n FROM visit_hourly WHERE ${cur.sql} GROUP BY verified`).bind(...cur.binds),
  ]);
  const n = (r: any) => r.results[0].n as number;
  const byPurpose = { training: 0, indexing: 0, retrieval: 0, unknown: 0 } as Record<string, number>;
  for (const r of purposes.results) byPurpose[r.purpose] = r.n;
  const v = Object.fromEntries(verif.results.map((r: any) => [r.verified, r.n])) as Record<string, number>;
  const checked = (v.verified ?? 0) + (v.unverified ?? 0);
  const h = n(hits), p = n(prevHits);
  return {
    range: w.range, from: w.from, to: w.to, hits: h, prevHits: p,
    delta: p > 0 ? Math.round(((h - p) / p) * 1000) / 10 : null,
    bots: n(bots), pages: n(pages), byPurpose,
    verifiedPct: checked ? Math.round(((v.verified ?? 0) / checked) * 1000) / 10 : null,
    unverified: v.unverified ?? 0,
    sites,
  };
}

async function timeseries(env: Env, w: Win) {
  const f = where(w, "hour");
  const { results } = await env.DB.prepare(
    `SELECT CAST((hour - ?) / ? AS INTEGER) AS i, purpose, SUM(hits) n FROM visit_hourly WHERE ${f.sql} GROUP BY i, purpose`,
  ).bind(w.from, w.bucket, ...f.binds).all<{ i: number; purpose: string; n: number }>();
  const count = w.span / w.bucket;
  const points = Array.from({ length: count }, (_, i) => ({ t: w.from + i * w.bucket, training: 0, indexing: 0, retrieval: 0, unknown: 0 }));
  for (const r of results) if (points[r.i]) (points[r.i] as any)[r.purpose] = r.n;
  return { range: w.range, bucket: w.bucket, points };
}

async function bots(env: Env, w: Win) {
  const f = where(w, "hour");
  const { results } = await env.DB.prepare(
    `SELECT bot_id, kind, purpose, SUM(hits) hits,
       SUM(CASE WHEN verified='verified' THEN hits ELSE 0 END) verified,
       SUM(CASE WHEN verified='unverified' THEN hits ELSE 0 END) unverified
     FROM visit_hourly WHERE ${f.sql} GROUP BY bot_id, kind, purpose ORDER BY hits DESC LIMIT 25`,
  ).bind(...f.binds).all<any>();
  return { bots: results.map((r) => ({ id: r.bot_id, ...botInfo(r.bot_id), kind: r.kind, purpose: r.purpose, hits: r.hits, verified: r.verified, unverified: r.unverified })) };
}

async function pages(env: Env, w: Win) {
  const f = where(w, "ts");
  const { results } = await env.DB.prepare(
    `SELECT path, COUNT(*) hits, COUNT(DISTINCT bot_id) bots,
       SUM(purpose='training') training, SUM(purpose='indexing') indexing, SUM(purpose='retrieval') retrieval
     FROM visits WHERE ${f.sql} GROUP BY path ORDER BY hits DESC, path LIMIT 20`,
  ).bind(...f.binds).all();
  return { pages: results };
}

async function heatmap(env: Env, w: Win) {
  const f = where(w, "hour");
  const { results } = await env.DB.prepare(
    `SELECT CAST(strftime('%w', hour, 'unixepoch') AS INTEGER) d, CAST(strftime('%H', hour, 'unixepoch') AS INTEGER) h, SUM(hits) hits
     FROM visit_hourly WHERE ${f.sql} GROUP BY d, h`,
  ).bind(...f.binds).all();
  return { cells: results };
}

const COLS = "v.id, v.ts, s.hostname AS site, v.ip, v.bot_id, v.bot_name, v.operator, v.kind, v.purpose, v.verified, v.path, v.method, v.status, v.country, v.asn, v.as_org, v.referer, v.ua";
const FROM = "visits v JOIN sites s ON s.id = v.site_id";

async function recent(env: Env, url: URL, w: Win) {
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);
  const f = where({ ...w, from: 0, to: 4e12 } as Win, "ts");
  const { results } = await env.DB.prepare(`SELECT ${COLS} FROM ${FROM} WHERE ${f.sql.replace(/\b(ts|kind|site_id)\b/g, "v.$1")} ORDER BY v.ts DESC, v.id DESC LIMIT ?`).bind(...f.binds, limit).all();
  return { visits: results };
}

const csvCell = (v: unknown) => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function exportRows(env: Env, w: Win) {
  const f = where(w, "ts");
  const { results } = await env.DB.prepare(`SELECT ${COLS} FROM ${FROM} WHERE ${f.sql.replace(/\b(ts|kind|site_id)\b/g, "v.$1")} ORDER BY v.ts DESC, v.id DESC LIMIT 10000`).bind(...f.binds).all<Record<string, unknown>>();
  return results;
}

/** Who is asking: a signed-in user (all of their sites) or a read key (all of its owner's sites, or just one). */
export interface Scope { userId: number; siteId: number | null }

export async function scopedSites(env: Env, scope: Scope) {
  const { results } = await env.DB.prepare("SELECT id, hostname FROM sites WHERE user_id = ? AND (? IS NULL OR id = ?) ORDER BY id")
    .bind(scope.userId, scope.siteId, scope.siteId).all<{ id: number; hostname: string }>();
  return results;
}

export async function handleApi(request: Request, env: Env, url: URL, scope: Scope): Promise<Response | null> {
  const p = url.pathname;
  const routes = ["/api/summary", "/api/timeseries", "/api/bots", "/api/pages", "/api/heatmap", "/api/recent", "/api/export.csv", "/api/export.json"];
  if (!routes.includes(p)) return null;
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  // Tenant scope comes from the session or the key, never from the request: only its sites are ever queried.
  const sites = await scopedSites(env, scope);
  let ids = sites.map((s) => s.id);
  const requested = url.searchParams.get("site");
  if (requested && requested !== "all") {
    if (!ids.includes(Number(requested))) return json({ error: "site_not_found" }, 404);
    ids = [Number(requested)];
  }
  const w = parse(url, ids);
  if (!w) return json({ error: "invalid_range", allowed: Object.keys(SPANS) }, 400);

  if (p === "/api/summary") return json(await summary(env, w, sites));
  if (p === "/api/timeseries") return json(await timeseries(env, w));
  if (p === "/api/bots") return json(await bots(env, w));
  if (p === "/api/pages") return json(await pages(env, w));
  if (p === "/api/heatmap") return json(await heatmap(env, w));
  if (p === "/api/recent") return json(await recent(env, url, w));
  const rows = await exportRows(env, w);
  if (p === "/api/export.json") return json({ visits: rows });
  const head = ["id", "ts", "site", "ip", "bot_id", "bot_name", "operator", "kind", "purpose", "verified", "path", "method", "status", "country", "asn", "as_org", "referer", "ua"];
  const lines = [head.join(","), ...rows.map((r) => head.map((c) => csvCell(c === "ts" ? new Date(Number(r.ts) * 1000).toISOString() : r[c])).join(","))];
  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="ai-bot-visits-${w.range}.csv"`, "cache-control": "no-store" },
  });
}
