import { handleApi } from "./api";
import { getUser, handleAuth } from "./auth";
import { runScheduled } from "./cron";
import { handleIngest } from "./ingest";
import { handleSites } from "./sites";

export { PasswordHasher } from "./hasher";

const json = (body: unknown, status: number) => Response.json(body, { status });

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    try {
      if (pathname === "/api/health") return Response.json({ ok: true });
      if (pathname === "/api/ingest") return await handleIngest(request, env);

      // Browsers always send Origin on cross-site writes: reject any that is not this site.
      const origin = request.headers.get("origin");
      if (request.method !== "GET" && request.method !== "HEAD" && origin && new URL(origin).host !== url.host) {
        return json({ error: "forbidden_origin" }, 403);
      }

      const auth = await handleAuth(request, env, pathname);
      if (auth) return auth;

      const user = await getUser(request, env);
      if (!user) return json({ error: "unauthorized" }, 401);
      return (await handleSites(request, env, pathname, user)) ?? (await handleApi(request, env, url, user)) ?? json({ error: "not_found" }, 404);
    } catch (err) {
      console.error(JSON.stringify({ msg: "unhandled", error: String(err) }));
      return json({ error: "internal" }, 500);
    }
  },
  scheduled(_controller, env, ctx) {
    ctx.waitUntil(runScheduled(env));
  },
} satisfies ExportedHandler<Env>;
