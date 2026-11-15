import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { PW, addSite, call, resetDb, signup } from "./helpers";

beforeEach(resetDb);

describe("signup", () => {
  it("creates an account, hashes the password, and starts a hardened session", async () => {
    const { res, cookie } = await signup("Ada@Example.com");
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ user: { email: "ada@example.com" } });
    const set = res.headers.get("set-cookie")!;
    expect(set).toMatch(/HttpOnly/); expect(set).toMatch(/Secure/); expect(set).toMatch(/SameSite=Lax/);
    const row = await env.DB.prepare("SELECT email, password_hash FROM users").first<{ email: string; password_hash: string }>();
    expect(row!.email).toBe("ada@example.com");
    expect(row!.password_hash).toMatch(/^pbkdf2-sha256\$100000\$/);
    expect(row!.password_hash).not.toContain(PW);
    expect(await (await call("/api/auth/me", { cookie })).json()).toEqual({ authenticated: true, email: "ada@example.com" });
  });
  it("stores only a hash of the session token", async () => {
    const { cookie } = await signup("a@example.com");
    const token = cookie.split("=")[1]!;
    const row = await env.DB.prepare("SELECT token_hash FROM sessions").first<{ token_hash: string }>();
    expect(row!.token_hash).not.toBe(token);
    expect(row!.token_hash).toMatch(/^[0-9a-f]{64}$/);
  });
  it("validates email and password", async () => {
    expect((await call("/api/auth/signup", { json: { email: "nope", password: PW } })).status).toBe(400);
    expect((await call("/api/auth/signup", { json: { email: "a@b.co", password: "short" } })).status).toBe(400);
    expect((await call("/api/auth/signup", { json: { email: "a@b.co", password: "x".repeat(129) } })).status).toBe(400);
    expect((await call("/api/auth/signup", { json: { email: "a@b.co", password: PW, website: "http://spam" } })).status).toBe(400);
  });
  it("rejects a duplicate email case-insensitively", async () => {
    await signup("dup@example.com");
    expect((await signup("DUP@example.com")).res.status).toBe(409);
  });
  it("rate limits signups per IP", async () => {
    let last = 0;
    for (let i = 0; i < 6; i++) last = (await call("/api/auth/signup", { json: { email: `u${i}@example.com`, password: PW }, ip: "9.9.9.9" })).status;
    expect(last).toBe(429);
  });
});

describe("signup throttling", () => {
  it("counts attempts atomically, so parallel signups cannot exceed the per-IP limit", async () => {
    const statuses = await Promise.all(Array.from({ length: 12 }, (_, i) =>
      call("/api/auth/signup", { json: { email: `p${i}@example.com`, password: PW }, ip: "6.6.6.6" }).then((r) => r.status)));
    expect(statuses.filter((s) => s === 201).length).toBeLessThanOrEqual(5);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(7);
  });
});

describe("login and logout", () => {
  it("logs in with the right password and rejects wrong ones identically", async () => {
    await signup("a@example.com");
    const ok = await call("/api/auth/login", { json: { email: "A@example.com", password: PW } });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toMatch(/abt_session=/);
    const badPw = await call("/api/auth/login", { json: { email: "a@example.com", password: "wrong password!" } });
    const noUser = await call("/api/auth/login", { json: { email: "ghost@example.com", password: "wrong password!" } });
    expect([badPw.status, noUser.status]).toEqual([401, 401]);
    expect(await badPw.json()).toEqual(await noUser.json());
    expect(badPw.headers.get("set-cookie")).toBeNull();
  });
  it("throttles failures per IP and per account", async () => {
    await signup("a@example.com");
    let last = 0;
    for (let i = 0; i < 11; i++) last = (await call("/api/auth/login", { json: { email: "a@example.com", password: "wrong password!" }, ip: "7.7.7.7" })).status;
    expect(last).toBe(429);
    expect((await call("/api/auth/login", { json: { email: "a@example.com", password: PW }, ip: "7.7.7.7" })).status).toBe(429);
    let acct = 0;
    for (let i = 0; i < 101; i++) acct = (await call("/api/auth/login", { json: { email: "b@example.com", password: "wrong password!" } })).status;
    expect(acct).toBe(429);
  }, 30_000); // 100+ sequential password checks: slow when the whole suite runs in parallel
  it("counts failures atomically, so parallel guesses cannot exceed the per-IP limit", async () => {
    await signup("race@example.com");
    const statuses = await Promise.all(Array.from({ length: 30 }, () =>
      call("/api/auth/login", { json: { email: "race@example.com", password: "wrong password!" }, ip: "9.9.9.9" }).then((r) => r.status)));
    expect(statuses.filter((s) => s === 401).length).toBeLessThanOrEqual(10);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(20);
  });
  it("does not let strangers lock the owner out of their own account", async () => {
    await signup("victim@example.com");
    for (let i = 0; i < 25; i++) await call("/api/auth/login", { json: { email: "victim@example.com", password: "wrong password!" } });
    const ok = await call("/api/auth/login", { json: { email: "victim@example.com", password: PW } });
    expect(ok.status).toBe(200);
  });
  it("successful logins never refund failures, so they cannot be used to stretch the per-IP limit", async () => {
    await signup("mine@example.com");
    const ip = "5.5.5.5";
    const guess = () => call("/api/auth/login", { json: { email: "someone-else@example.com", password: "wrong password!" }, ip }).then((r) => r.status);
    const mine = () => call("/api/auth/login", { json: { email: "mine@example.com", password: PW }, ip }).then((r) => r.status);
    for (let i = 0; i < 9; i++) expect(await guess()).toBe(401);
    for (let i = 0; i < 5; i++) expect(await mine()).toBe(200); // successes in between
    expect(await guess()).toBe(401); // the 10th failure is still allowed
    expect(await guess()).toBe(429); // the 11th is refused: nine successes' worth of refunds did not happen
    expect(await mine()).toBe(429);
  });
  it("requests blocked by the IP limit do not count against the account, so one IP cannot lock the owner out", async () => {
    await signup("owner@example.com");
    for (let i = 0; i < 150; i++) await call("/api/auth/login", { json: { email: "owner@example.com", password: "wrong password!" }, ip: "4.4.4.4" });
    const ok = await call("/api/auth/login", { json: { email: "owner@example.com", password: PW }, ip: "4.4.4.5" });
    expect(ok.status).toBe(200);
  });
  it("a successful login does not use up the failure allowance", async () => {
    await signup("ok@example.com");
    for (let i = 0; i < 15; i++) expect((await call("/api/auth/login", { json: { email: "ok@example.com", password: PW }, ip: "8.8.8.8" })).status).toBe(200);
  });
  it("logout deletes the session row, so the old cookie stops working", async () => {
    const { cookie } = await signup("a@example.com");
    expect((await call("/api/auth/logout", { method: "POST", cookie })).status).toBe(200);
    expect(await (await call("/api/auth/me", { cookie })).json()).toEqual({ authenticated: false });
    expect((await env.DB.prepare("SELECT COUNT(*) n FROM sessions").first<{ n: number }>())!.n).toBe(0);
  });
  it("rejects tampered, unknown and expired session cookies", async () => {
    const { cookie } = await signup("a@example.com");
    expect((await call("/api/sites", { cookie: cookie + "x" })).status).toBe(401);
    expect((await call("/api/sites", { cookie: "abt_session=nope" })).status).toBe(401);
    await env.DB.prepare("UPDATE sessions SET expires_at = 1").run();
    expect((await call("/api/sites", { cookie })).status).toBe(401);
  });
  it("blocks cross-origin state changes", async () => {
    const { cookie } = await signup("a@example.com");
    const res = await call("/api/sites", { json: { hostname: "x.com" }, cookie, headers: { origin: "https://evil.test" } });
    expect(res.status).toBe(403);
    const same = await call("/api/sites", { json: { hostname: "x.com" }, cookie, headers: { origin: "https://t.test" } });
    expect(same.status).toBe(201);
  });
});

describe("account management", () => {
  it("changes the password, keeps this session, ends the others", async () => {
    const a = await signup("a@example.com");
    const other = (await call("/api/auth/login", { json: { email: "a@example.com", password: PW } })).headers.get("set-cookie")!.split(";")[0]!;
    expect((await call("/api/auth/password", { json: { current: "not it at all", next: "brand new password" }, cookie: a.cookie })).status).toBe(401);
    expect((await call("/api/auth/password", { json: { current: PW, next: "short" }, cookie: a.cookie })).status).toBe(400);
    expect((await call("/api/auth/password", { json: { current: PW, next: "brand new password" }, cookie: a.cookie })).status).toBe(200);
    expect((await call("/api/auth/me", { cookie: a.cookie })).status).toBe(200);
    expect(await (await call("/api/auth/me", { cookie: a.cookie })).json()).toMatchObject({ authenticated: true });
    expect(await (await call("/api/auth/me", { cookie: other })).json()).toEqual({ authenticated: false });
    expect((await call("/api/auth/login", { json: { email: "a@example.com", password: "brand new password" } })).status).toBe(200);
  });
  it("deletes the account with all its sites and data", async () => {
    const a = await signup("a@example.com");
    const b = await signup("b@example.com");
    const site = await addSite(a.cookie, "a.com");
    await addSite(b.cookie, "b.com");
    await env.DB.prepare("INSERT INTO visits (ts,site_id,bot_id,bot_name,operator,kind,purpose,path) VALUES (1,?,'gptbot','GPTBot','OpenAI','ai','training','/')").bind(site.id).run();
    expect((await call("/api/auth/account", { method: "DELETE", json: { password: "wrong wrong wrong" }, cookie: a.cookie })).status).toBe(401);
    expect((await call("/api/auth/account", { method: "DELETE", json: { password: PW }, cookie: a.cookie })).status).toBe(200);
    const count = async (t: string) => (await env.DB.prepare(`SELECT COUNT(*) n FROM ${t}`).first<{ n: number }>())!.n;
    expect([await count("users"), await count("sites"), await count("visits"), await count("sessions")]).toEqual([1, 1, 0, 1]);
  });
});
