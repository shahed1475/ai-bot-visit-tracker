import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { handleSensor } from "../src/sensor";

const GPT = "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot";
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const env = { TRACKER_URL: "https://tracker.test/", TRACKER_KEY: "abt_key" };
const req = (ua: string) => new Request("https://site.test/blog/post?utm=1", { headers: { "user-agent": ua, "cf-connecting-ip": "8.8.8.8" } });

describe("edge sensor", () => {
  it("passes humans through untouched and sends nothing", async () => {
    const calls: unknown[] = []; const origin = new Response("page");
    const ctx = createExecutionContext();
    const res = await handleSensor(req(CHROME), env, ctx, async () => origin, (async (...a: unknown[]) => { calls.push(a); return new Response(); }) as typeof fetch);
    await waitOnExecutionContext(ctx);
    expect(res).toBe(origin); expect(calls).toHaveLength(0);
  });
  it("reports bots with the site key and the origin status, without blocking", async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const ctx = createExecutionContext();
    const res = await handleSensor(req(GPT), env, ctx, async () => new Response("nf", { status: 404 }), (async (url: string, init: RequestInit) => { seen = { url, init }; return new Response("{}"); }) as unknown as typeof fetch);
    expect(res.status).toBe(404);
    await waitOnExecutionContext(ctx);
    expect(seen!.url).toBe("https://tracker.test/api/ingest");
    expect((seen!.init.headers as Record<string, string>).authorization).toBe("Bearer abt_key");
    expect(JSON.parse(seen!.init.body as string)).toMatchObject({ path: "/blog/post", status: 404, ip: "8.8.8.8" });
  });
  it("still returns the origin response when the tracker is down", async () => {
    const ctx = createExecutionContext();
    const res = await handleSensor(req(GPT), env, ctx, async () => new Response("ok"), (async () => { throw new Error("down"); }) as typeof fetch);
    await waitOnExecutionContext(ctx);
    expect(await res.text()).toBe("ok");
  });
});
