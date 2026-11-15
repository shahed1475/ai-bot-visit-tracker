import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { GPT, PW, addSite, call, ingest, signup } from "./helpers";
import { resetCaches } from "../src/store";

const now = Math.floor(Date.now() / 1000);
const bearer = (key: string) => ({ authorization: `Bearer ${key}` });
const mint = async (cookie: string, body: Record<string, unknown>) => {
  const res = await call("/api/keys", { json: body, cookie });
  return { res, body: (await res.json()) as any };
};
let a = "", siteA = 0, b = "";

beforeEach(async () => {
  await env.DB.batch(["api_keys", "visits", "visit_hourly", "meta", "sessions", "sites", "users"].map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
  resetCaches();
  a = (await signup("a@example.com")).cookie; b = (await signup("b@example.com")).cookie;
  siteA = (await addSite(a, "a.com")).id;
});

describe("sending keys (ingest)", () => {
  it("mints a named key once, stores only a hash, and lists it without the secret", async () => {
    const { res, body } = await mint(a, { name: "Production server", kind: "ingest", siteId: siteA });
    expect(res.status).toBe(201);
    expect(body.key).toMatch(/^abt_[A-Za-z0-9_-]{43}$/);
    expect(body.apiKey).toMatchObject({ name: "Production server", kind: "ingest", siteId: siteA, hostname: "a.com", keyPrefix: body.key.slice(0, 10) });
    const row = await env.DB.prepare("SELECT key_hash FROM api_keys WHERE name = 'Production server'").first<{ key_hash: string }>();
    expect(row!.key_hash).toMatch(/^[0-9a-f]{64}$/);
    const list = await (await call("/api/keys", { cookie: a })).json() as { keys: any[] };
    expect(JSON.stringify(list)).not.toContain(body.key);
    expect(list.keys.map((k) => k.name)).toEqual(["Default", "Production server"]);
    expect(list.keys[1].lastUsedAt).toBeNull();
  });
  it("authenticates ingest, records last use, and keys are independent", async () => {
    const k1 = (await mint(a, { name: "one", kind: "ingest", siteId: siteA })).body.key;
    const k2 = (await mint(a, { name: "two", kind: "ingest", siteId: siteA })).body.key;
    expect((await ingest(k1, { ua: GPT, path: "/x" })).status).toBe(200);
    const list = await (await call("/api/keys", { cookie: a })).json() as { keys: any[] };
    expect(list.keys.find((k) => k.name === "one").lastUsedAt).toBeGreaterThan(now - 5);
    expect(list.keys.find((k) => k.name === "two").lastUsedAt).toBeNull();
    const id1 = list.keys.find((k) => k.name === "one").id;
    expect((await call(`/api/keys/${id1}`, { method: "DELETE", cookie: a })).status).toBe(200);
    expect((await ingest(k1, { ua: GPT, path: "/x" })).status).toBe(401);
    expect((await ingest(k2, { ua: GPT, path: "/x" })).status).toBe(200);
  });
  it("validates input and enforces ownership and limits", async () => {
    expect((await mint(a, { name: "", kind: "ingest", siteId: siteA })).res.status).toBe(400);
    expect((await mint(a, { name: "x".repeat(41), kind: "ingest", siteId: siteA })).res.status).toBe(400);
    expect((await mint(a, { name: "k", kind: "admin", siteId: siteA })).res.status).toBe(400);
    expect((await mint(a, { name: "k", kind: "ingest" })).res.status).toBe(400);
    expect((await mint(a, { name: "k", kind: "ingest", siteId: siteA })).res.status).toBe(201);
    expect((await mint(b, { name: "k", kind: "ingest", siteId: siteA })).res.status).toBe(404);
    expect((await call("/api/keys", { json: { name: "k", kind: "read" } })).status).toBe(401);
    for (let i = 0; i < 18; i++) expect((await mint(a, { name: `k${i}`, kind: "read" })).res.status).toBe(201);
    expect((await mint(a, { name: "overflow", kind: "read" })).res.status).toBe(403);
  });
  it("a user cannot list or revoke another user's keys", async () => {
    const list = await (await call("/api/keys", { cookie: a })).json() as { keys: any[] };
    expect((await call(`/api/keys/${list.keys[0].id}`, { method: "DELETE", cookie: b })).status).toBe(404);
    expect(((await (await call("/api/keys", { cookie: b })).json()) as { keys: unknown[] }).keys).toHaveLength(0);
  });
  it("rotating a site's default key revokes the old one and keeps other keys", async () => {
    const other = (await mint(a, { name: "other", kind: "ingest", siteId: siteA })).body.key;
    const rot = (await (await call(`/api/sites/${siteA}/rotate-key`, { method: "POST", cookie: a })).json()) as { key: string };
    expect((await ingest(rot.key, { ua: GPT, path: "/" })).status).toBe(200);
    expect((await ingest(other, { ua: GPT, path: "/" })).status).toBe(200);
  });
  it("deleting a site removes its keys", async () => {
    const k = (await mint(a, { name: "n", kind: "ingest", siteId: siteA })).body.key;
    await call(`/api/sites/${siteA}`, { method: "DELETE", cookie: a });
    expect((await ingest(k, { ua: GPT, path: "/" })).status).toBe(401);
    expect((await env.DB.prepare("SELECT COUNT(*) n FROM api_keys WHERE site_id = ?").bind(siteA).first<{ n: number }>())!.n).toBe(0);
  });
});

describe("read keys and /api/v1", () => {
  let siteB2 = 0, ingestA = "", readAll = "", readOne = "";
  beforeEach(async () => {
    siteB2 = (await addSite(a, "second.com")).id;
    ingestA = (await mint(a, { name: "i", kind: "ingest", siteId: siteA })).body.key;
    const k2 = (await mint(a, { name: "i2", kind: "ingest", siteId: siteB2 })).body.key;
    await ingest(ingestA, { events: [{ ua: GPT, path: "/a1", ts: now - 600 }, { ua: GPT, path: "/a2", ts: now - 900 }] });
    await ingest(k2, { events: [{ ua: GPT, path: "/b1", ts: now - 600 }] });
    readAll = (await mint(a, { name: "dash", kind: "read" })).body.key;
    readOne = (await mint(a, { name: "one site", kind: "read", siteId: siteA })).body.key;
  });
  const v1 = (path: string, key?: string) => call(`/api/v1${path}`, { headers: key ? bearer(key) : {} });

  it("read keys have their own prefix and return the same data as the dashboard", async () => {
    expect(readAll).toMatch(/^abtr_[A-Za-z0-9_-]{43}$/);
    const viaKey = (await (await v1("/summary?range=7d", readAll)).json()) as any;
    const viaSession = (await (await call("/api/summary?range=7d", { cookie: a })).json()) as any;
    expect(viaKey.hits).toBe(3);
    expect(viaKey).toEqual(viaSession);
    for (const p of ["timeseries", "bots", "pages", "heatmap", "recent", "export.json"]) expect((await v1(`/${p}?range=7d`, readAll)).status, p).toBe(200);
    expect((await (await v1("/sites", readAll)).json() as any).sites.map((s: any) => s.hostname)).toEqual(["a.com", "second.com"]);
  });
  it("a read key tied to one site only ever sees that site", async () => {
    expect(((await (await v1("/summary?range=7d", readOne)).json()) as any).hits).toBe(2);
    expect((await v1(`/summary?range=7d&site=${siteB2}`, readOne)).status).toBe(404);
    expect((await (await v1("/sites", readOne)).json() as any).sites).toHaveLength(1);
  });
  it("keys never cross over: ingest keys cannot read, read keys cannot write or mint", async () => {
    expect((await v1("/summary", ingestA)).status).toBe(401);
    expect((await ingest(readAll, { ua: GPT, path: "/" })).status).toBe(401);
    expect((await call("/api/keys", { headers: bearer(readAll) })).status).toBe(401);
    expect((await call("/api/v1/summary", { method: "POST", json: {}, headers: bearer(readAll) })).status).toBe(405);
    expect((await call("/api/summary?range=7d", { headers: bearer(readAll) })).status).toBe(401); // /api/* stays session-only
  });
  it("anonymous, garbage and revoked keys are rejected; another user's key sees only their data", async () => {
    expect((await v1("/summary")).status).toBe(401);
    expect((await v1("/summary", "abtr_notarealkey")).status).toBe(401);
    const bRead = (await mint(b, { name: "b", kind: "read" })).body.key;
    expect(((await (await v1("/summary?range=7d", bRead)).json()) as any)).toMatchObject({ hits: 0, sites: [] });
    const list = await (await call("/api/keys", { cookie: a })).json() as { keys: any[] };
    await call(`/api/keys/${list.keys.find((k) => k.name === "dash").id}`, { method: "DELETE", cookie: a });
    expect((await v1("/summary", readAll)).status).toBe(401);
  });
});

describe("edge cases", () => {
  const count = async (sql: string, ...binds: unknown[]) => (await env.DB.prepare(sql).bind(...binds).first<{ n: number }>())!.n;
  const keysOf = async (cookie: string) => ((await (await call("/api/keys", { cookie })).json()) as { keys: any[] }).keys;

  it("refreshes a key's last use at most once a minute, so a busy sensor does not write on every request", async () => {
    const m = await mint(a, { name: "busy", kind: "ingest", siteId: siteA });
    const id = m.body.apiKey.id as number;
    const set = (ts: number) => env.DB.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").bind(ts, id).run();
    const get = async () => (await env.DB.prepare("SELECT last_used_at v FROM api_keys WHERE id = ?").bind(id).first<{ v: number }>())!.v;
    await set(now - 10);
    expect((await ingest(m.body.key, { ua: GPT, path: "/" })).status).toBe(200);
    expect(await get()).toBe(now - 10);
    await set(now - 120);
    expect((await ingest(m.body.key, { ua: GPT, path: "/" })).status).toBe(200);
    expect(await get()).toBeGreaterThan(now - 5);
  });

  it("a failed last-use write never fails the request: reads keep working when D1 refuses writes", async () => {
    const readAll = (await mint(a, { name: "all", kind: "read" })).body.key;
    await env.DB.exec("CREATE TRIGGER no_key_updates BEFORE UPDATE ON api_keys BEGIN SELECT RAISE(ABORT, 'write quota exceeded'); END");
    try {
      expect((await call("/api/v1/summary?range=7d", { headers: bearer(readAll) })).status).toBe(200);
    } finally {
      await env.DB.exec("DROP TRIGGER no_key_updates");
    }
  });

  it("rotate-key after the Default key was revoked creates a fresh Default and keeps exactly one", async () => {
    await call(`/api/keys/${(await keysOf(a))[0].id}`, { method: "DELETE", cookie: a });
    const before = (await (await call("/api/sites", { cookie: a })).json()) as { sites: any[] };
    expect(before.sites[0].keyPrefix).toBeNull();
    await call(`/api/sites/${siteA}/rotate-key`, { method: "POST", cookie: a });
    const rot = (await (await call(`/api/sites/${siteA}/rotate-key`, { method: "POST", cookie: a })).json()) as { key: string };
    expect((await ingest(rot.key, { ua: GPT, path: "/" })).status).toBe(200);
    const after = (await (await call("/api/sites", { cookie: a })).json()) as { sites: any[] };
    expect(after.sites[0].keyPrefix).toBe(rot.key.slice(0, 10));
    expect(await count("SELECT COUNT(*) n FROM api_keys WHERE site_id = ? AND is_default = 1", siteA)).toBe(1);
  });

  it("deleting an account removes all of its keys, including read keys that belong to no site", async () => {
    await mint(a, { name: "everything", kind: "read" });
    await mint(a, { name: "one", kind: "read", siteId: siteA });
    expect((await call("/api/auth/account", { method: "DELETE", json: { password: PW }, cookie: a })).status).toBe(200);
    expect(await count("SELECT COUNT(*) n FROM api_keys")).toBe(0);
  });

  it("deleting a site removes the read keys tied to it, and they stop working", async () => {
    const readOne = (await mint(a, { name: "one", kind: "read", siteId: siteA })).body.key;
    expect((await call("/api/v1/summary", { headers: bearer(readOne) })).status).toBe(200);
    await call(`/api/sites/${siteA}`, { method: "DELETE", cookie: a });
    expect((await call("/api/v1/summary", { headers: bearer(readOne) })).status).toBe(401);
  });

  it("rejects names that are only whitespace and site ids that are not whole numbers", async () => {
    expect((await mint(a, { name: "   ", kind: "read" })).res.status).toBe(400);
    expect((await mint(a, { name: "n", kind: "read", siteId: String(siteA) })).res.status).toBe(400);
    expect((await mint(a, { name: "n", kind: "read", siteId: 1.5 })).res.status).toBe(400);
    expect((await mint(a, { name: "n", kind: "ingest", siteId: null })).res.status).toBe(400);
    expect((await mint(b, { name: "n", kind: "read", siteId: siteA })).res.status).toBe(404);
    expect((await mint(a, { name: "  padded  ", kind: "read" })).body.apiKey.name).toBe("padded");
  });

  it("/api/v1 serves CSV, 404s unknown paths, and never lists keys", async () => {
    const readAll = (await mint(a, { name: "all", kind: "read" })).body.key;
    const csv = await call("/api/v1/export.csv?range=7d", { headers: bearer(readAll) });
    expect(csv.status).toBe(200);
    expect(csv.headers.get("content-type")).toContain("text/csv");
    expect((await call("/api/v1/nope", { headers: bearer(readAll) })).status).toBe(404);
    expect((await call("/api/v1/keys", { headers: bearer(readAll) })).status).toBe(404);
  });
});
