import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { purgeOld, refreshIpRanges } from "../src/cron";

beforeEach(async () => {
  await env.DB.batch(["visits", "visit_hourly", "ip_ranges", "meta"].map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
});

const ranges = async (bot: string) =>
  (await env.DB.prepare("SELECT cidr FROM ip_ranges WHERE bot_id=? ORDER BY cidr").bind(bot).all<{ cidr: string }>()).results.map((r) => r.cidr);

describe("refreshIpRanges", () => {
  it("stores IPv4 and IPv6 prefixes, and keeps old ranges when a source fails", async () => {
    await env.DB.prepare("INSERT INTO ip_ranges (bot_id,cidr) VALUES ('googlebot','66.249.64.0/27')").run();
    await env.DB.prepare("INSERT INTO ip_ranges (bot_id,cidr) VALUES ('gptbot','1.1.1.0/24')").run();
    const fake = async (url: string | URL | Request) => {
      if (String(url).includes("openai.com/gptbot.json"))
        return Response.json({ prefixes: [{ ipv4Prefix: "20.15.240.64/26" }, { ipv6Prefix: "2001:db8::/32" }, { junk: 1 }] });
      return new Response("nope", { status: 500 });
    };
    const out = await refreshIpRanges(env, fake as typeof fetch);
    expect(out.updated).toContain("gptbot");
    expect(await ranges("gptbot")).toEqual(["20.15.240.64/26", "2001:db8::/32"]);
    expect(await ranges("googlebot")).toEqual(["66.249.64.0/27"]);
  });
  it("survives a fetch that throws and a non-JSON body", async () => {
    const fake = async (url: string | URL | Request) => {
      if (String(url).includes("perplexitybot")) throw new Error("boom");
      return new Response("<html>", { status: 200 });
    };
    await expect(refreshIpRanges(env, fake as typeof fetch)).resolves.toMatchObject({ updated: [] });
  });
});

describe("purgeOld", () => {
  it("deletes only rows older than the cutoff, in chunks", async () => {
    const now = Math.floor(Date.now() / 1000);
    const old = now - 100 * 86400;
    const ins = env.DB.prepare(
      "INSERT INTO visits (ts,site_id,bot_id,bot_name,operator,kind,purpose,path) VALUES (?,1,'gptbot','GPTBot','OpenAI','ai','training','/')",
    );
    for (let i = 0; i < 3; i++)
      await env.DB.batch(Array.from({ length: 900 }, () => ins.bind(old)));
    await env.DB.batch([ins.bind(now - 86400), ins.bind(now)]);
    await env.DB.prepare("INSERT INTO visit_hourly (hour,site_id,bot_id,kind,purpose,verified,hits) VALUES (?,1,'gptbot','ai','training','unknown',1)").bind(old).run();
    await env.DB.prepare("INSERT INTO meta (key,value) VALUES ('login:1.2.3.4:1','3')").run();
    const out = await purgeOld(env, 90);
    expect(out.visits).toBe(2700);
    expect((await env.DB.prepare("SELECT COUNT(*) n FROM visits").first<{ n: number }>())!.n).toBe(2);
    expect((await env.DB.prepare("SELECT COUNT(*) n FROM visit_hourly").first<{ n: number }>())!.n).toBe(0);
    expect((await env.DB.prepare("SELECT COUNT(*) n FROM meta WHERE key LIKE 'login:%'").first<{ n: number }>())!.n).toBe(0);
  });
});
