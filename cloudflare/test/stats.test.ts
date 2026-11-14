import { beforeEach, describe, expect, it } from "vitest";
import { CLAUDE_USER, GOOGLEBOT, GPT, addSite, call, ingest, resetDb, signup } from "./helpers";
import { resetCaches } from "../src/store";

const now = Math.floor(Date.now() / 1000);
let a = "", b = "", keyA = "", keyB = "", idA = 0;
beforeEach(async () => {
  await resetDb(); resetCaches();
  a = (await signup("a@example.com")).cookie; b = (await signup("b@example.com")).cookie;
  const sa = await addSite(a, "a.com"), sb = await addSite(b, "b.com");
  keyA = sa.key; keyB = sb.key; idA = sa.id;
  await ingest(keyA, { events: [
    { ua: GPT, path: "/blog/x", ts: now - 3600 }, { ua: GPT, path: "/blog/y", ts: now - 7200 }, { ua: CLAUDE_USER, path: "/blog/x", ts: now - 5400 },
    { ua: GPT, path: "/old", ts: now - 8 * 86400 }, { ua: GOOGLEBOT, path: "/=cmd", ts: now - 3600 }, { ua: "=1+1 GPTBot/1.4", path: "/z", ts: now - 10800 } ] });
  await ingest(keyB, { events: [{ ua: GPT, path: "/secret-b", ts: now - 3600 }] });
});
const get = (p: string, cookie = a) => call(p, { cookie }).then((r) => r.json() as Promise<any>);

describe("tenant isolation", () => {
  it("every endpoint requires login", async () => {
    for (const p of ["summary", "timeseries", "bots", "pages", "heatmap", "recent", "export.csv", "export.json"]) expect((await call(`/api/${p}`)).status, p).toBe(401);
  });
  it("a user only ever sees their own data", async () => {
    expect((await get("/api/summary?range=7d")).hits).toBe(4);
    expect((await get("/api/summary?range=7d", b)).hits).toBe(1);
    expect(JSON.stringify(await get("/api/pages?range=7d"))).not.toContain("secret-b");
    expect(JSON.stringify(await get("/api/recent?limit=50"))).not.toContain("secret-b");
    expect(JSON.stringify(await get("/api/export.json?range=7d&ai=0"))).not.toContain("secret-b");
    expect((await call("/api/export.csv?range=7d", { cookie: b })).status).toBe(200);
  });
  it("a foreign or unknown site id is rejected, not silently empty", async () => {
    expect((await call(`/api/summary?site=${idA}`, { cookie: b })).status).toBe(404);
    expect((await call("/api/summary?site=99999", { cookie: a })).status).toBe(404);
    expect((await get(`/api/summary?range=7d&site=${idA}`)).hits).toBe(4);
  });
  it("a new user with no sites gets empty results", async () => {
    const c = (await signup("c@example.com")).cookie;
    expect((await get("/api/summary?range=7d", c))).toMatchObject({ hits: 0, sites: [] });
  });
});

describe("stats", () => {
  it("summary matches data with delta vs previous period", async () => {
    const s = await get("/api/summary?range=7d");
    expect(s).toMatchObject({ hits: 4, prevHits: 1, delta: 300, bots: 2, pages: 3 });
    expect(s.byPurpose).toMatchObject({ training: 3, retrieval: 1 });
    expect(s.sites).toEqual([{ id: idA, hostname: "a.com" }]);
  });
  it("ai=0 includes search crawlers; default excludes them", async () => {
    expect((await get("/api/summary?range=7d&ai=0")).hits).toBe(5);
  });
  it("timeseries is zero-filled and sums to the summary", async () => {
    const t = await get("/api/timeseries?range=7d");
    expect(t.points).toHaveLength(7);
    expect(t.points.reduce((x: number, p: any) => x + p.training + p.indexing + p.retrieval + p.unknown, 0)).toBe(4);
    expect((await get("/api/timeseries?range=24h")).points).toHaveLength(24);
  });
  it("bots, pages, heatmap, recent", async () => {
    expect((await get("/api/bots?range=7d")).bots[0]).toMatchObject({ id: "gptbot", name: "GPTBot", hits: 3 });
    expect((await get("/api/pages?range=7d")).pages[0]).toMatchObject({ path: "/blog/x", hits: 2, bots: 2 });
    expect((await get("/api/heatmap?range=7d")).cells.reduce((x: number, c: any) => x + c.hits, 0)).toBe(4);
    const r = await get("/api/recent?limit=2");
    expect(r.visits).toHaveLength(2); expect(r.visits[0].site).toBe("a.com");
    expect((await call("/api/summary?range=forever", { cookie: a })).status).toBe(400);
  });
  it("CSV neutralises formula injection", async () => {
    const text = await (await call("/api/export.csv?range=7d&ai=0", { cookie: a })).text();
    expect(text.split("\n")[0]).toContain("ts,site,ip,bot_id");
    expect(text).toContain("'=1+1"); expect(text).not.toMatch(/,=1\+1/);
  });
});
