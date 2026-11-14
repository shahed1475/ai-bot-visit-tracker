import { detect, verify, type Match } from "./detect";

export interface VisitEvent {
  ts?: number;
  ip?: string | null;
  ua: string;
  path: string;
  method?: string;
  status?: number;
  referer?: string | null;
  country?: string | null;
  asn?: number | null;
  asOrg?: string | null;
}

const RANGE_TTL_MS = 10 * 60 * 1000;
let rangeCache: { at: number; map: Map<string, string[]> } | null = null;
export const resetCaches = () => { rangeCache = null; };

/** Read-only shared config, safe to cache per isolate. */
export async function loadRanges(db: D1Database): Promise<Map<string, string[]>> {
  if (rangeCache && Date.now() - rangeCache.at < RANGE_TTL_MS) return rangeCache.map;
  const { results } = await db.prepare("SELECT bot_id, cidr FROM ip_ranges").all<{ bot_id: string; cidr: string }>();
  const map = new Map<string, string[]>();
  for (const r of results) (map.get(r.bot_id) ?? map.set(r.bot_id, []).get(r.bot_id)!).push(r.cidr);
  rangeCache = { at: Date.now(), map };
  return map;
}

const stripQuery = (s: string) => s.split(/[?#]/)[0]!;
const clip = (s: string | null | undefined, n: number) => (s ? s.slice(0, n) : null);

export function normalize(ev: VisitEvent): VisitEvent & { ts: number } {
  let ts = Number(ev.ts);
  if (!Number.isFinite(ts) || ts <= 0) ts = Date.now() / 1000;
  if (ts > 1e11) ts /= 1000;
  return {
    ...ev,
    ts: Math.floor(ts),
    path: stripQuery(ev.path).slice(0, 2048) || "/",
    ua: ev.ua.slice(0, 512),
    referer: ev.referer ? stripQuery(ev.referer).slice(0, 512) : null,
  };
}

export function isEvent(x: unknown): x is VisitEvent {
  const e = x as Record<string, unknown>;
  return !!e && typeof e === "object" && typeof e.ua === "string" && typeof e.path === "string";
}

function statements(db: D1Database, siteId: number, ev: ReturnType<typeof normalize>, m: Match, v: string, source: string) {
  const hour = Math.floor(ev.ts / 3600) * 3600;
  return [
    db.prepare(
      `INSERT INTO visits (ts,site_id,ip,bot_id,bot_name,operator,kind,purpose,verified,path,method,status,ua,referer,country,asn,as_org,source)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).bind(ev.ts, siteId, clip(ev.ip, 45), m.id, m.name, m.operator, m.kind, m.purpose, v, ev.path,
      clip(ev.method, 10), Number.isInteger(ev.status) ? ev.status : null, ev.ua, ev.referer ?? null,
      clip(ev.country, 2), Number.isInteger(ev.asn) ? ev.asn : null, clip(ev.asOrg, 100), source),
    db.prepare(
      `INSERT INTO visit_hourly (hour,site_id,bot_id,kind,purpose,verified,hits) VALUES (?,?,?,?,?,?,1)
       ON CONFLICT(hour,site_id,bot_id,purpose,verified) DO UPDATE SET hits = hits + 1`,
    ).bind(hour, siteId, m.id, m.kind, m.purpose, v),
  ];
}

/** Detect, verify and store bot visits. Non-bot events are ignored. Returns counts. */
export async function recordVisits(db: D1Database, siteId: number, events: VisitEvent[], source = "ingest") {
  const ranges = await loadRanges(db);
  const stmts: D1PreparedStatement[] = [];
  let stored = 0;
  for (const raw of events) {
    const ev = normalize(raw);
    const m = detect(ev.ua);
    if (!m) continue;
    stmts.push(...statements(db, siteId, ev, m, verify(m, ev.ip, ranges), source));
    stored++;
  }
  for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100));
  return { stored, ignored: events.length - stored };
}
