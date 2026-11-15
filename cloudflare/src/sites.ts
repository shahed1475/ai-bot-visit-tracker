import { deleteSitesData, type User } from "./auth";
import { newKey } from "./keys";

const MAX_SITES = 5;
const HOSTNAME = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

const DEFAULT_KEY_COLS = "INSERT INTO api_keys (user_id,site_id,name,kind,key_hash,key_prefix,is_default,created_at)";

// keyPrefix is the site's Default key; null when the owner revoked it from the key list.
const publicSite = (r: { id: number; hostname: string; key_prefix: string | null; created_at: number; last_visit?: number | null }) =>
  ({ id: r.id, hostname: r.hostname, keyPrefix: r.key_prefix, createdAt: r.created_at, lastVisit: r.last_visit ?? null });

export async function handleSites(request: Request, env: Env, pathname: string, user: User): Promise<Response | null> {
  const m = pathname.match(/^\/api\/sites(?:\/(\d+)(\/rotate-key)?)?$/);
  if (!m) return null;
  const id = m[1] ? Number(m[1]) : null;

  if (id === null) {
    if (request.method === "GET") {
      const { results } = await env.DB.prepare(
        `SELECT s.id, s.hostname, s.created_at,
           (SELECT key_prefix FROM api_keys WHERE site_id = s.id AND is_default = 1) AS key_prefix,
           (SELECT MAX(ts) FROM visits WHERE site_id = s.id) AS last_visit
         FROM sites s WHERE s.user_id = ? ORDER BY s.id`,
      ).bind(user.id).all<any>();
      return json({ sites: results.map(publicSite), max: MAX_SITES });
    }
    if (request.method === "POST") {
      let hostname = "";
      try { hostname = String(((await request.json()) as { hostname?: unknown }).hostname ?? "").trim().toLowerCase(); } catch { /* invalid */ }
      if (!HOSTNAME.test(hostname)) return json({ error: "invalid_hostname" }, 400);
      const existing = await env.DB.prepare("SELECT COUNT(*) n, SUM(hostname = ?) dup FROM sites WHERE user_id = ?").bind(hostname, user.id).first<{ n: number; dup: number | null }>();
      if (existing?.dup) return json({ error: "site_exists" }, 409);
      if ((existing?.n ?? 0) >= MAX_SITES) return json({ error: "site_limit", max: MAX_SITES }, 403);
      const k = await newKey("ingest");
      const now = Math.floor(Date.now() / 1000);
      // One batch = one transaction: a site never exists without its Default key.
      const [created] = await env.DB.batch([
        env.DB.prepare("INSERT INTO sites (user_id,hostname,created_at) VALUES (?,?,?)").bind(user.id, hostname, now),
        env.DB.prepare(`${DEFAULT_KEY_COLS} VALUES (?,last_insert_rowid(),'Default','ingest',?,?,1,?)`).bind(user.id, k.hash, k.prefix, now),
      ]);
      return Response.json({ site: publicSite({ id: created!.meta.last_row_id as number, hostname, key_prefix: k.prefix, created_at: now }), key: k.key }, { status: 201, headers: { "cache-control": "no-store" } });
    }
    return json({ error: "method_not_allowed" }, 405);
  }

  // Ownership is enforced in the query itself: a foreign id simply matches nothing.
  const owned = await env.DB.prepare("SELECT id FROM sites WHERE id = ? AND user_id = ?").bind(id, user.id).first();
  if (!owned) return json({ error: "site_not_found" }, 404);
  if (m[2] && request.method === "POST") {
    const k = await newKey("ingest");
    // Replaces only the Default key. Keys the owner minted themselves keep working.
    await env.DB.batch([
      env.DB.prepare("DELETE FROM api_keys WHERE site_id = ? AND is_default = 1").bind(id),
      env.DB.prepare(`${DEFAULT_KEY_COLS} VALUES (?,?,'Default','ingest',?,?,1,?)`).bind(user.id, id, k.hash, k.prefix, Math.floor(Date.now() / 1000)),
    ]);
    return Response.json({ key: k.key, keyPrefix: k.prefix }, { headers: { "cache-control": "no-store" } });
  }
  if (!m[2] && request.method === "DELETE") {
    await deleteSitesData(env, "SELECT id FROM sites WHERE id = ?", id);
    await env.DB.prepare("DELETE FROM sites WHERE id = ? AND user_id = ?").bind(id, user.id).run();
    return json({ ok: true });
  }
  return json({ error: "method_not_allowed" }, 405);
}
