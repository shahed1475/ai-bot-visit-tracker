import { sha256Hex } from "./crypto";
import { isEvent, recordVisits, type VisitEvent } from "./store";

const MAX_BODY = 256 * 1024;
const MAX_EVENTS = 100;
const json = (body: unknown, status = 200) => Response.json(body, { status });

/** The Bearer key identifies the site (and therefore the owner). Any `site` field in the payload is ignored. */
export async function handleIngest(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer abt_")) return json({ error: "unauthorized" }, 401);
  const site = await env.DB.prepare("SELECT id FROM sites WHERE key_hash = ?").bind(await sha256Hex(auth.slice(7))).first<{ id: number }>();
  if (!site) return json({ error: "unauthorized" }, 401);

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) return json({ error: "too_large" }, 413);
  const text = await request.text();
  if (text.length > MAX_BODY) return json({ error: "too_large" }, 413);

  let body: any;
  try { body = JSON.parse(text); } catch { return json({ error: "invalid_json" }, 400); }
  const list: unknown[] = Array.isArray(body?.events) ? body.events : [body];
  if (list.length > MAX_EVENTS) return json({ error: "too_many_events", max: MAX_EVENTS }, 400);

  const valid = list.filter(isEvent) as VisitEvent[];
  const { stored, ignored } = await recordVisits(env.DB, site.id, valid);
  return json({ stored, ignored, rejected: list.length - valid.length });
}
