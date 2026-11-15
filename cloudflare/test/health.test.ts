import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("scaffold", () => {
  it("creates the three tables via migrations", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('visits','visit_hourly','ip_ranges') ORDER BY name",
    ).all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual(["ip_ranges", "visit_hourly", "visits"]);
  });

  it("GET /api/health returns ok", async () => {
    const res = await exports.default.fetch("https://t.test/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
