// Test harness around the REAL sensor logic (cloudflare/src/sensor.ts). Only the origin is swapped for a local server,
// because `wrangler dev` has no real site behind it. Per-request headers let the test aim the sensor at a dead tracker
// or a wrong key. Not shipped; used only by tests/e2e/run.mjs.
import { handleSensor, type SensorEnv } from "../../../../cloudflare/src/sensor";

type Env = SensorEnv & { ORIGIN: string };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/ready") return new Response("ok");
    const e: SensorEnv = {
      TRACKER_URL: request.headers.get("x-e2e-tracker") ?? env.TRACKER_URL,
      TRACKER_KEY: request.headers.get("x-e2e-key") ?? env.TRACKER_KEY,
    };
    const origin = (r: Request) => fetch(env.ORIGIN + new URL(r.url).pathname + new URL(r.url).search, { headers: r.headers });
    return handleSensor(request, e, ctx, origin);
  },
} satisfies ExportedHandler<Env>;
