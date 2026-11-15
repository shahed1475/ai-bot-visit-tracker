import { randomToken, sha256Hex } from "./crypto";

const COOKIE = "abt_session";
const SESSION_TTL = 30 * 86400;
const ATTRS = "Path=/; HttpOnly; Secure; SameSite=Lax";
// loginFailPerAccount is a ceiling against guessing spread over many IPs. It is deliberately far above the per-IP
// limit: a low one would let anyone who knows an email address lock its owner out.
const LIMITS = { signupPerIp: 5, loginFailPerIp: 10, loginFailPerAccount: 100 };
// A well-formed hash that never matches: lets login do equal work for unknown emails (no timing oracle).
const DUMMY_HASH = `pbkdf2-sha256$100000$${btoa("\0".repeat(16))}$${btoa("\0".repeat(32))}`;

type AEnv = Env & { TURNSTILE_SECRET?: string; TURNSTILE_SITEKEY?: string };
export interface User { id: number; email: string; sessionHash: string }
const json = (body: unknown, status = 200, headers?: HeadersInit) => Response.json(body, { status, headers });
const hasher = (env: Env) => env.HASHER.getByName(`h${Math.floor(Math.random() * 16)}`);
const hourKey = (prefix: string, id: string) => `${prefix}:${id}:${Math.floor(Date.now() / 3_600_000)}`;

/** Adds one to a counter in a single statement and returns the new value, so parallel requests cannot all read the same old number. */
async function hit(env: Env, key: string): Promise<number> {
  const row = await env.DB.prepare(
    "INSERT INTO meta (key,value) VALUES (?,'1') ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + 1 RETURNING value",
  ).bind(key).first<{ value: string }>();
  return Number(row?.value ?? 1);
}
const release = (env: Env, key: string) => env.DB.prepare(
  "UPDATE meta SET value = MAX(CAST(value AS INTEGER) - 1, 0) WHERE key = ?",
).bind(key).run();

export function cookieToken(request: Request): string | null {
  const m = (request.headers.get("cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([A-Za-z0-9_-]{20,64})(?:;|$)`));
  return m ? m[1]! : null;
}

export async function getUser(request: Request, env: Env): Promise<User | null> {
  const token = cookieToken(request);
  if (!token) return null;
  const sessionHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    "SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?",
  ).bind(sessionHash, Math.floor(Date.now() / 1000)).first<{ id: number; email: string }>();
  return row ? { ...row, sessionHash } : null;
}

async function startSession(env: Env, userId: number): Promise<string> {
  const token = randomToken(32);
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare("INSERT INTO sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)")
    .bind(await sha256Hex(token), userId, now, now + SESSION_TTL).run();
  return `${COOKIE}=${token}; ${ATTRS}; Max-Age=${SESSION_TTL}`;
}
const clearCookie = `${COOKIE}=; ${ATTRS}; Max-Age=0`;

export async function readJson(request: Request): Promise<Record<string, any> | null> {
  try {
    const text = await request.text();
    if (text.length > 8192) return null;
    const body = JSON.parse(text);
    return body && typeof body === "object" ? body : null;
  } catch { return null; }
}

const validEmail = (e: string) => e.length <= 254 && /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(e);
const validPassword = (p: unknown): p is string => typeof p === "string" && p.length >= 10 && p.length <= 128;
const ip = (request: Request) => request.headers.get("cf-connecting-ip") ?? "unknown";

async function verifyTurnstile(env: Env, token: unknown, remoteip: string): Promise<boolean> {
  if (!(env as AEnv).TURNSTILE_SECRET) return true; // optional protection
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", signal: AbortSignal.timeout(8000),
      body: new URLSearchParams({ secret: (env as AEnv).TURNSTILE_SECRET ?? "", response: token, remoteip }),
    });
    return res.ok && ((await res.json()) as { success?: boolean }).success === true;
  } catch { return false; }
}

async function signup(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  if (!body) return json({ error: "invalid_request" }, 400);
  if (typeof body.website === "string" && body.website !== "") return json({ error: "invalid_request" }, 400); // honeypot
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!validEmail(email)) return json({ error: "invalid_email" }, 400);
  if (!validPassword(body.password)) return json({ error: "weak_password", min: 10, max: 128 }, 400);

  const key = hourKey("signup", ip(request));
  if ((await hit(env, key)) > LIMITS.signupPerIp) return json({ error: "too_many_attempts" }, 429);
  if (!(await verifyTurnstile(env, body.turnstileToken, ip(request)))) return json({ error: "captcha_failed" }, 400);

  if (await env.DB.prepare("SELECT 1 FROM users WHERE email = ?").bind(email).first()) return json({ error: "email_taken" }, 409);
  const hash = await hasher(env).hash(body.password);
  try {
    const r = await env.DB.prepare("INSERT INTO users (email,password_hash,created_at) VALUES (?,?,?)").bind(email, hash, Math.floor(Date.now() / 1000)).run();
    const cookie = await startSession(env, r.meta.last_row_id as number);
    return json({ user: { email } }, 201, { "set-cookie": cookie });
  } catch {
    return json({ error: "email_taken" }, 409); // lost a race on the UNIQUE constraint
  }
}

async function login(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = typeof body?.password === "string" ? body.password : "";
  const ipKey = hourKey("login-ip", ip(request)), acctKey = hourKey("login-acct", email);
  // Count the attempt before checking the password. Counting only after a failure lets parallel guesses all pass the check.
  // The IP is counted first and a blocked IP stops here: its requests must not touch the account counter, or one
  // source could spend the account's whole allowance and lock the owner out.
  if ((await hit(env, ipKey)) > LIMITS.loginFailPerIp) return json({ error: "too_many_attempts" }, 429);
  if ((await hit(env, acctKey)) > LIMITS.loginFailPerAccount) return json({ error: "too_many_attempts" }, 429);
  const user = await env.DB.prepare("SELECT id, password_hash FROM users WHERE email = ?").bind(email).first<{ id: number; password_hash: string }>();
  const ok = password.length > 0 && password.length <= 128 && (await hasher(env).verify(password, user?.password_hash ?? DUMMY_HASH)) && !!user;
  if (!ok || !user) return json({ error: "invalid_credentials" }, 401);
  await Promise.all([release(env, ipKey), release(env, acctKey)]); // only failures count against the limits
  return json({ user: { email } }, 200, { "set-cookie": await startSession(env, user.id) });
}

async function changePassword(request: Request, env: Env, user: User): Promise<Response> {
  const body = await readJson(request);
  if (!body) return json({ error: "invalid_request" }, 400);
  if (!validPassword(body.next)) return json({ error: "weak_password", min: 10, max: 128 }, 400);
  const row = await env.DB.prepare("SELECT password_hash FROM users WHERE id = ?").bind(user.id).first<{ password_hash: string }>();
  if (typeof body.current !== "string" || !row || !(await hasher(env).verify(body.current, row.password_hash))) return json({ error: "invalid_credentials" }, 401);
  const hash = await hasher(env).hash(body.next);
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(hash, user.id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").bind(user.id, user.sessionHash),
  ]);
  return json({ ok: true });
}

async function deleteAccount(request: Request, env: Env, user: User): Promise<Response> {
  const body = await readJson(request);
  const row = await env.DB.prepare("SELECT password_hash FROM users WHERE id = ?").bind(user.id).first<{ password_hash: string }>();
  if (typeof body?.password !== "string" || !row || !(await hasher(env).verify(body.password, row.password_hash))) return json({ error: "invalid_credentials" }, 401);
  await deleteSitesData(env, "SELECT id FROM sites WHERE user_id = ?", user.id);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM api_keys WHERE user_id = ?").bind(user.id), // includes read keys that are not tied to a site
    env.DB.prepare("DELETE FROM sites WHERE user_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM users WHERE id = ?").bind(user.id),
  ]);
  return json({ ok: true }, 200, { "set-cookie": clearCookie });
}

/** Delete visits in chunks (a single huge DELETE can time out) plus the rollup rows and the sites' keys. */
export async function deleteSitesData(env: Env, siteIdsSql: string, param: number) {
  for (let i = 0; i < 500; i++) {
    const r = await env.DB.prepare(`DELETE FROM visits WHERE id IN (SELECT id FROM visits WHERE site_id IN (${siteIdsSql}) LIMIT 1000)`).bind(param).run();
    if ((r.meta.changes ?? 0) < 1000) break;
  }
  await env.DB.prepare(`DELETE FROM visit_hourly WHERE site_id IN (${siteIdsSql})`).bind(param).run();
  await env.DB.prepare(`DELETE FROM api_keys WHERE site_id IN (${siteIdsSql})`).bind(param).run();
}

export async function handleAuth(request: Request, env: Env, pathname: string): Promise<Response | null> {
  if (pathname === "/api/config") return json({ turnstileSiteKey: (env as AEnv).TURNSTILE_SECRET ? (env as AEnv).TURNSTILE_SITEKEY ?? null : null });
  if (pathname === "/api/auth/me") {
    const user = await getUser(request, env);
    return json(user ? { authenticated: true, email: user.email } : { authenticated: false }, 200, { "cache-control": "no-store" });
  }
  if (!pathname.startsWith("/api/auth/")) return null;
  const method = request.method;
  if (pathname === "/api/auth/signup" && method === "POST") return signup(request, env);
  if (pathname === "/api/auth/login" && method === "POST") return login(request, env);
  if (pathname === "/api/auth/logout" && method === "POST") {
    const token = cookieToken(request);
    if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
    return json({ ok: true }, 200, { "set-cookie": clearCookie });
  }
  const user = await getUser(request, env);
  if (!user) return json({ error: "unauthorized" }, 401);
  if (pathname === "/api/auth/password" && method === "POST") return changePassword(request, env, user);
  if (pathname === "/api/auth/account" && method === "DELETE") return deleteAccount(request, env, user);
  return json({ error: "not_found" }, 404);
}
