import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import worker from "../src/index";

describe("scaffold", () => {
  it("creates the three tables via migrations", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('visits','visit_hourly','ip_ranges') ORDER BY name",
    ).all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual(["ip_ranges", "visit_hourly", "visits"]);
  });

  it("GET /api/health checks the database and reports when the vendor ranges were last refreshed", async () => {
    await env.DB.prepare("DELETE FROM meta WHERE key='ranges_refreshed_at'").run();
    let res = await exports.default.fetch("https://t.test/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: true, rangesAgeHours: null });

    const twoHoursAgo = Math.floor(Date.now() / 1000) - 2 * 3600;
    await env.DB.prepare("INSERT INTO meta (key,value) VALUES ('ranges_refreshed_at',?)").bind(String(twoHoursAgo)).run();
    res = await exports.default.fetch("https://t.test/api/health");
    expect(await res.json()).toEqual({ ok: true, db: true, rangesAgeHours: 2 });
  });

  it("GET /api/health answers 503 when the database is unreachable, without leaking the error", async () => {
    const broken = { ...env, DB: { prepare: () => { throw new Error("D1_ERROR: secret detail"); } } } as unknown as Env;
    const res = await worker.fetch(new Request("https://t.test/api/health"), broken, {} as ExecutionContext);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, db: false });
  });
});
