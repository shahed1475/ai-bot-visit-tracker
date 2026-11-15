import { handleApi } from "./api";
import { getUser, handleAuth } from "./auth";
import { runScheduled } from "./cron";
import { handleIngest } from "./ingest";
import { handleKeys } from "./keys";
import { handleSites } from "./sites";
import { handleV1 } from "./v1";

export { PasswordHasher } from "./hasher";

const json = (body: unknown, status: number) => Response.json(body, { status });

/** The host of an Origin header, or null when it is not a URL (browsers send the literal "null" from sandboxed frames). */
function originHost(origin: string): string | null {
  try { return new URL(origin).host; } catch { return null; }
}

/** Liveness plus a real D1 round trip, so an uptime monitor sees a database outage. The error text is logged, never returned. */
async function handleHealth(env: Env): Promise<Response> {
  try {
    const row = await env.DB.prepare("SELECT value FROM meta WHERE key = 'ranges_refreshed_at'").first<{ value: string }>();
    const at = row ? Number(row.value) : NaN;
    const rangesAgeHours = Number.isFinite(at) ? Math.max(0, Math.floor((Date.now() / 1000 - at) / 3600)) : null;
    return Response.json({ ok: true, db: true, rangesAgeHours });
  } catch (err) {
    console.error(JSON.stringify({ msg: "health_failed", error: String(err) }));
    return Response.json({ ok: false, db: false }, { status: 503 });
  }
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    try {
      if (pathname === "/api/health") return await handleHealth(env);
      if (pathname === "/api/ingest") return await handleIngest(request, env);
      // Bearer-key APIs carry no cookie, so they sit before the cookie-only checks below (CSRF does not apply).
      if (pathname.startsWith("/api/v1/")) return await handleV1(request, env, url);

      // Browsers always send Origin on cross-site writes: reject any that is not this site.
      const origin = request.headers.get("origin");
      if (request.method !== "GET" && request.method !== "HEAD" && origin && originHost(origin) !== url.host) {
        return json({ error: "forbidden_origin" }, 403);
      }

      const auth = await handleAuth(request, env, pathname);
      if (auth) return auth;

      const user = await getUser(request, env);
      if (!user) return json({ error: "unauthorized" }, 401);
      return (await handleSites(request, env, pathname, user))
        ?? (await handleKeys(request, env, pathname, user))
        ?? (await handleApi(request, env, url, { userId: user.id, siteId: null }))
        ?? json({ error: "not_found" }, 404);
    } catch (err) {
      console.error(JSON.stringify({ msg: "unhandled", error: String(err) }));
      return json({ error: "internal" }, 500);
    }
  },
  scheduled(_controller, env, ctx) {
    ctx.waitUntil(runScheduled(env));
  },
} satisfies ExportedHandler<Env>;
