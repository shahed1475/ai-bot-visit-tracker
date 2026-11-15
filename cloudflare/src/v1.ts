import { handleApi, scopedSites } from "./api";
import { authenticateKey } from "./keys";

const json = (body: unknown, status = 200, headers?: HeadersInit) => Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });

/**
 * Read-only API for scripts and other tools, authenticated by a read key (`Authorization: Bearer abtr_...`).
 * It serves exactly what the dashboard serves, through the same code, so a key can never see more than its owner
 * (or, for a key tied to one site, more than that site). Everything except GET is refused.
 */
export async function handleV1(request: Request, env: Env, url: URL): Promise<Response> {
  const key = await authenticateKey(request, env, "read");
  if (!key) return json({ error: "unauthorized" }, 401, { "www-authenticate": "Bearer" });
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, { allow: "GET" });

  const scope = { userId: key.userId, siteId: key.siteId };
  const rest = url.pathname.slice("/api/v1".length);
  if (rest === "/sites") return json({ sites: await scopedSites(env, scope) });
  const inner = new URL(url);
  inner.pathname = `/api${rest}`;
  return (await handleApi(request, env, inner, scope)) ?? json({ error: "not_found" }, 404);
}
