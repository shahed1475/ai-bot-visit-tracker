import { detect } from "./detect";

export interface SensorEnv { TRACKER_URL: string; TRACKER_KEY: string }
type Origin = (request: Request) => Promise<Response>;
type Send = typeof fetch;

/**
 * Edge sensor: forwards every request to your origin untouched and, for bot user agents only, reports the
 * visit to your AI Bot Tracker over HTTPS after the response is produced. It never throws or delays a visitor.
 * It runs in YOUR Cloudflare account, so it talks to the tracker by URL + site key (not a database binding).
 */
export async function handleSensor(request: Request, env: SensorEnv, ctx: ExecutionContext, origin: Origin = (r) => fetch(r), send: Send = fetch): Promise<Response> {
  let isBot = false;
  try { isBot = detect(request.headers.get("user-agent")) !== null; } catch { /* fail open */ }
  const response = await origin(request);
  if (!isBot) return response;

  ctx.waitUntil((async () => {
    try {
      const url = new URL(request.url);
      const cf = (request as Request & { cf?: IncomingRequestCfProperties }).cf;
      await send(`${env.TRACKER_URL.replace(/\/+$/, "")}/api/ingest`, {
        method: "POST", signal: AbortSignal.timeout(5000),
        headers: { authorization: `Bearer ${env.TRACKER_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({
          ip: request.headers.get("cf-connecting-ip"), ua: request.headers.get("user-agent") ?? "", path: url.pathname,
          method: request.method, status: response.status, referer: request.headers.get("referer") ?? undefined,
          country: cf?.country, asn: cf?.asn, asOrg: cf?.asOrganization,
        }),
      });
    } catch (err) {
      console.error(JSON.stringify({ msg: "sensor_report_failed", error: String(err) }));
    }
  })());
  return response;
}
