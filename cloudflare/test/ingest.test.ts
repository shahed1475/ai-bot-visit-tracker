import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { GPT, addSite, call, ingest, resetDb, signup } from "./helpers";
import { resetCaches } from "../src/store";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const rows = async () => (await env.DB.prepare("SELECT * FROM visits ORDER BY id").all<any>()).results;
let key = "", siteId = 0;

beforeEach(async () => {
  await resetDb(); resetCaches();
  const u = await signup("owner@example.com");
  const s = await addSite(u.cookie, "example.com");
  key = s.key; siteId = s.id;
});

describe("POST /api/ingest", () => {
  it("stores a visit under the key's site and counts it in the rollup", async () => {
    const res = await ingest(key, { ip: "8.8.8.8", ua: GPT, path: "/blog/a" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ stored: 1, ignored: 0, rejected: 0 });
    await ingest(key, { ip: "8.8.8.8", ua: GPT, path: "/blog/b" });
    const r = await rows();
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ site_id: siteId, bot_id: "gptbot", kind: "ai", purpose: "training", verified: "unknown" });
    expect((await env.DB.prepare("SELECT hits FROM visit_hourly").all<{ hits: number }>()).results).toEqual([{ hits: 2 }]);
  });
  it("ignores a site field in the payload: the key decides the tenant", async () => {
    const other = await signup("other@example.com");
    const o = await addSite(other.cookie, "other.com");
    await ingest(key, { site: "other.com", ua: GPT, path: "/" });
    expect((await rows()).map((r) => r.site_id)).toEqual([siteId]);
    expect(o.id).not.toBe(siteId);
  });
  it("ignores human traffic without writing", async () => {
    const res = await ingest(key, { events: [{ ua: CHROME, path: "/" }, { ua: "", path: "/" }] });
    expect(await res.json()).toMatchObject({ stored: 0, ignored: 2 });
    expect(await rows()).toHaveLength(0);
  });
  it("marks spoofed vs genuine IPs when vendor ranges are loaded", async () => {
    await env.DB.prepare("INSERT INTO ip_ranges (bot_id,cidr) VALUES ('gptbot','20.15.240.64/26')").run();
    await ingest(key, { events: [{ ip: "20.15.240.70", ua: GPT, path: "/" }, { ip: "6.6.6.6", ua: GPT, path: "/" }] });
    expect((await rows()).map((r) => r.verified).sort()).toEqual(["unverified", "verified"]);
  });
  it("strips query strings, truncates the UA", async () => {
    await ingest(key, { ua: GPT + "y".repeat(2000), path: "/p?token=secret#x", referer: "https://a.test/x?q=1" });
    const [r] = await rows();
    expect([r.path, r.referer, r.ua.length]).toEqual(["/p", "https://a.test/x", 512]);
  });
  it("rejects missing/unknown keys, wrong method, bad JSON and oversize input", async () => {
    const ev = { ua: GPT, path: "/" };
    expect((await call("/api/ingest", { json: ev })).status).toBe(401);
    expect((await ingest("abt_nope", ev)).status).toBe(401);
    expect((await call("/api/ingest")).status).toBe(405);
    expect((await call("/api/ingest", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" } })).status).toBe(400);
    expect((await ingest(key, { events: Array.from({ length: 101 }, () => ev) })).status).toBe(400);
    expect((await ingest(key, { pad: "x".repeat(300_000) })).status).toBe(413);
    expect(await rows()).toHaveLength(0);
  });
  it("counts malformed events as rejected without failing the batch", async () => {
    const res = await ingest(key, { events: [{ ua: GPT, path: "/" }, { ua: 5 }, "str"] });
    expect(await res.json()).toMatchObject({ stored: 1, rejected: 2 });
  });
});
