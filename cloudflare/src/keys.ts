import { readJson, type User } from "./auth";
import { randomToken, sha256Hex } from "./crypto";

/** Per user, counting each site's Default key. Creating a site is never blocked by this cap. */
export const MAX_KEYS = 20;
const MAX_NAME = 40;
/** last_used_at is refreshed at most this often per key, so a busy sensor does not turn every request into a write. */
const LAST_USED_EVERY = 60;

export type KeyKind = "ingest" | "read";
const PREFIX: Record<KeyKind, string> = { ingest: "abt_", read: "abtr_" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

/** The secret is only ever returned from the call that creates it; the database keeps its sha256. */
export async function newKey(kind: KeyKind) {
  const key = `${PREFIX[kind]}${randomToken(32)}`;
  return { key, hash: await sha256Hex(key), prefix: key.slice(0, 10) };
}

export interface KeyAuth { id: number; userId: number; siteId: number | null }

/** Authenticate `Authorization: Bearer <key>` against one kind of key. Null for anything else; callers answer 401. */
export async function authenticateKey(request: Request, env: Env, kind: KeyKind): Promise<KeyAuth | null> {
  const header = request.headers.get("authorization") ?? "";
  if (header.length > 200 || !header.startsWith(`Bearer ${PREFIX[kind]}`)) return null;
  const row = await env.DB.prepare("SELECT id, user_id, site_id, last_used_at FROM api_keys WHERE key_hash = ? AND kind = ?")
    .bind(await sha256Hex(header.slice(7)), kind).first<{ id: number; user_id: number; site_id: number | null; last_used_at: number | null }>();
  if (!row) return null;
  const now = Math.floor(Date.now() / 1000);
  if (row.last_used_at === null || now - row.last_used_at >= LAST_USED_EVERY) {
    // Bookkeeping only. When D1 refuses writes (daily free-tier quota) reads must keep working, so never fail the request over it.
    try {
      await env.DB.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").bind(now, row.id).run();
    } catch (err) {
      console.error(JSON.stringify({ msg: "key_last_used_failed", error: String(err) }));
    }
  }
  return { id: row.id, userId: row.user_id, siteId: row.site_id };
}

interface KeyRow { id: number; name: string; kind: KeyKind; site_id: number | null; hostname: string | null; key_prefix: string; created_at: number; last_used_at: number | null }
const publicKey = (r: KeyRow) => ({
  id: r.id, name: r.name, kind: r.kind, siteId: r.site_id, hostname: r.hostname,
  keyPrefix: r.key_prefix, createdAt: r.created_at, lastUsedAt: r.last_used_at,
});

async function mint(request: Request, env: Env, user: User): Promise<Response> {
  const body = await readJson(request);
  if (!body) return json({ error: "invalid_request" }, 400);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > MAX_NAME) return json({ error: "invalid_name", max: MAX_NAME }, 400);
  const kind = body.kind;
  if (kind !== "ingest" && kind !== "read") return json({ error: "invalid_kind", allowed: ["ingest", "read"] }, 400);

  // An ingest key must name its site; a read key may be limited to one site or left open to all of the owner's sites.
  const given = body.siteId === undefined || body.siteId === null ? null : body.siteId;
  if (given === null && kind === "ingest") return json({ error: "site_required" }, 400);
  if (given !== null && !Number.isSafeInteger(given)) return json({ error: "invalid_site" }, 400);
  let hostname: string | null = null;
  if (given !== null) {
    // Ownership is part of the query itself: another user's site id matches nothing.
    const site = await env.DB.prepare("SELECT hostname FROM sites WHERE id = ? AND user_id = ?").bind(given, user.id).first<{ hostname: string }>();
    if (!site) return json({ error: "site_not_found" }, 404);
    hostname = site.hostname;
  }

  const k = await newKey(kind);
  const now = Math.floor(Date.now() / 1000);
  // The cap lives inside the INSERT so two parallel requests cannot both slip past it.
  const r = await env.DB.prepare(
    `INSERT INTO api_keys (user_id,site_id,name,kind,key_hash,key_prefix,created_at)
     SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM api_keys WHERE user_id = ?) < ?`,
  ).bind(user.id, given, name, kind, k.hash, k.prefix, now, user.id, MAX_KEYS).run();
  if (!r.meta.changes) return json({ error: "key_limit", max: MAX_KEYS }, 403);
  const apiKey = publicKey({ id: r.meta.last_row_id as number, name, kind, site_id: given, hostname, key_prefix: k.prefix, created_at: now, last_used_at: null });
  return json({ key: k.key, apiKey }, 201);
}

export async function handleKeys(request: Request, env: Env, pathname: string, user: User): Promise<Response | null> {
  const m = pathname.match(/^\/api\/keys(?:\/(\d+))?$/);
  if (!m) return null;
  if (!m[1]) {
    if (request.method === "GET") {
      const { results } = await env.DB.prepare(
        `SELECT k.id, k.name, k.kind, k.site_id, s.hostname, k.key_prefix, k.created_at, k.last_used_at
         FROM api_keys k LEFT JOIN sites s ON s.id = k.site_id WHERE k.user_id = ? ORDER BY k.id`,
      ).bind(user.id).all<KeyRow>();
      return json({ keys: results.map(publicKey), max: MAX_KEYS });
    }
    return request.method === "POST" ? mint(request, env, user) : json({ error: "method_not_allowed" }, 405);
  }
  if (request.method !== "DELETE") return json({ error: "method_not_allowed" }, 405);
  const r = await env.DB.prepare("DELETE FROM api_keys WHERE id = ? AND user_id = ?").bind(Number(m[1]), user.id).run();
  return r.meta.changes ? json({ ok: true }) : json({ error: "key_not_found" }, 404);
}
