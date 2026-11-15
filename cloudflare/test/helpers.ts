import { env, exports } from "cloudflare:workers";

export const PW = "correct horse battery";
let n = 0;
export const uniqueIp = () => `10.${Math.floor(++n / 250)}.${n % 250}.7`;

export interface CallInit { method?: string; json?: unknown; cookie?: string; headers?: Record<string, string>; ip?: string }
export function call(path: string, init: CallInit = {}) {
  const headers: Record<string, string> = { "cf-connecting-ip": init.ip ?? uniqueIp(), ...init.headers };
  if (init.json !== undefined) headers["content-type"] = "application/json";
  if (init.cookie) headers.cookie = init.cookie;
  return exports.default.fetch(`https://t.test${path}`, { method: init.method ?? (init.json !== undefined ? "POST" : "GET"), headers, body: init.json !== undefined ? JSON.stringify(init.json) : undefined });
}

export async function signup(email: string, password = PW) {
  const res = await call("/api/auth/signup", { json: { email, password } });
  const cookie = res.headers.get("set-cookie")?.split(";")[0] ?? "";
  return { res, cookie };
}

export async function addSite(cookie: string, hostname: string) {
  const res = await call("/api/sites", { json: { hostname }, cookie });
  const body = (await res.json()) as { site?: { id: number; hostname: string; keyPrefix: string }; key?: string };
  return { res, id: body.site?.id as number, key: body.key as string, body };
}

export const ingest = (key: string, body: unknown) => call("/api/ingest", { json: body, headers: { authorization: `Bearer ${key}` } });

export async function resetDb() {
  const tables = ["api_keys", "visits", "visit_hourly", "ip_ranges", "meta", "sessions", "sites", "users"];
  await env.DB.batch(tables.map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
}
export const GPT = "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot";
export const CLAUDE_USER = "compatible; Claude-User/1.0; +Claude-User@anthropic.com";
export const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
