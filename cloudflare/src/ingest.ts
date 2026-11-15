import { authenticateKey } from "./keys";
import { isEvent, recordVisits, type VisitEvent } from "./store";

const MAX_BODY = 256 * 1024;
const MAX_EVENTS = 100;
const json = (body: unknown, status = 200) => Response.json(body, { status });

/** The Bearer ingest key identifies the site (and therefore the owner). Any `site` field in the payload is ignored. */
export async function handleIngest(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const key = await authenticateKey(request, env, "ingest");
  if (!key || key.siteId === null) return json({ error: "unauthorized" }, 401);
  const site = { id: key.siteId };

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
