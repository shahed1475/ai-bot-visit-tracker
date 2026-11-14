import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { addSite, call, resetDb, signup } from "./helpers";

beforeEach(resetDb);

describe("sites", () => {
  it("requires login", async () => {
    expect((await call("/api/sites")).status).toBe(401);
    expect((await call("/api/sites", { json: { hostname: "a.com" } })).status).toBe(401);
  });
  it("creates a site, shows the key once, and stores only its hash", async () => {
    const { cookie } = await signup("a@example.com");
    const s = await addSite(cookie, "Example.COM");
    expect(s.res.status).toBe(201);
    expect(s.body.site).toMatchObject({ hostname: "example.com" });
    expect(s.key).toMatch(/^abt_[A-Za-z0-9_-]{43}$/);
    expect(s.body.site!.keyPrefix).toBe(s.key.slice(0, 10));
    const row = await env.DB.prepare("SELECT key_hash FROM sites").first<{ key_hash: string }>();
    expect(row!.key_hash).toMatch(/^[0-9a-f]{64}$/);
    const list = await (await call("/api/sites", { cookie })).json() as { sites: Record<string, unknown>[] };
    expect(list.sites).toHaveLength(1);
    expect(JSON.stringify(list)).not.toContain(s.key);
    expect(Object.keys(list.sites[0]!)).not.toContain("key_hash");
  });
  it("validates hostnames, rejects duplicates and caps sites per account", async () => {
    const { cookie } = await signup("a@example.com");
    for (const bad of ["", "http://a.com", "a.com/path", "a b.com", "-bad.com", "nodot", "x".repeat(260) + ".com"]) {
      expect((await call("/api/sites", { json: { hostname: bad }, cookie })).status, bad).toBe(400);
    }
    expect((await addSite(cookie, "a.com")).res.status).toBe(201);
    expect((await addSite(cookie, "A.com")).res.status).toBe(409);
    for (const h of ["b.com", "c.com", "d.com", "e.com"]) expect((await addSite(cookie, h)).res.status).toBe(201);
    expect((await addSite(cookie, "f.com")).res.status).toBe(403);
  });
  it("rotates a key: the old key stops working immediately", async () => {
    const { cookie } = await signup("a@example.com");
    const s = await addSite(cookie, "a.com");
    const rot = await call(`/api/sites/${s.id}/rotate-key`, { method: "POST", cookie });
    const { key } = (await rot.json()) as { key: string };
    expect(key).not.toBe(s.key);
    const ev = { ua: "compatible; GPTBot/1.4", path: "/" };
    expect((await call("/api/ingest", { json: ev, headers: { authorization: `Bearer ${s.key}` } })).status).toBe(401);
    expect((await call("/api/ingest", { json: ev, headers: { authorization: `Bearer ${key}` } })).status).toBe(200);
  });
  it("deletes a site together with its visits", async () => {
    const { cookie } = await signup("a@example.com");
    const s = await addSite(cookie, "a.com");
    await env.DB.prepare("INSERT INTO visits (ts,site_id,bot_id,bot_name,operator,kind,purpose,path) VALUES (1,?,'gptbot','GPTBot','OpenAI','ai','training','/')").bind(s.id).run();
    await env.DB.prepare("INSERT INTO visit_hourly (hour,site_id,bot_id,kind,purpose,verified,hits) VALUES (0,?,'gptbot','ai','training','unknown',1)").bind(s.id).run();
    expect((await call(`/api/sites/${s.id}`, { method: "DELETE", cookie })).status).toBe(200);
    for (const t of ["sites", "visits", "visit_hourly"]) expect((await env.DB.prepare(`SELECT COUNT(*) n FROM ${t}`).first<{ n: number }>())!.n, t).toBe(0);
  });
  it("never lets one user touch another user's site", async () => {
    const a = await signup("a@example.com");
    const b = await signup("b@example.com");
    const s = await addSite(a.cookie, "a.com");
    expect((await call(`/api/sites/${s.id}/rotate-key`, { method: "POST", cookie: b.cookie })).status).toBe(404);
    expect((await call(`/api/sites/${s.id}`, { method: "DELETE", cookie: b.cookie })).status).toBe(404);
    expect(((await (await call("/api/sites", { cookie: b.cookie })).json()) as { sites: unknown[] }).sites).toHaveLength(0);
    expect((await env.DB.prepare("SELECT COUNT(*) n FROM sites").first<{ n: number }>())!.n).toBe(1);
  });
});
