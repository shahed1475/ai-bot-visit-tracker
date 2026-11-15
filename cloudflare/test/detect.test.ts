import { describe, expect, it } from "vitest";
import fixtures from "../../signatures/fixtures.json";
import { detect, verify } from "../src/detect";
import { inRanges } from "../src/cidr";

describe("detect() against shared fixtures", () => {
  for (const c of fixtures.cases) {
    it(`${c.expect?.id ?? "human/empty"}: ${c.ua.slice(0, 50)}`, () => {
      const m = detect(c.ua);
      if (c.expect === null) return expect(m).toBeNull();
      expect(m).toMatchObject({ id: c.expect.id, kind: c.expect.kind, purpose: c.expect.purpose });
    });
  }
  it("handles null/undefined/huge user agents without throwing", () => {
    expect(detect(undefined)).toBeNull();
    expect(detect(null)).toBeNull();
    expect(detect("x".repeat(100_000))).toBeNull();
  });
  it("falls back to a generic bot for unknown crawlers", () => {
    expect(detect("Mozilla/5.0 (compatible; FooBarBot/1.0)")).toMatchObject({
      id: "generic-bot", kind: "other", purpose: "unknown",
    });
    expect(detect("Mozilla/5.0 (Linux; Android 10; CUBOT_X30) Chrome/120")).toBeNull();
  });
});

describe("inRanges()", () => {
  it("matches IPv4 CIDR boundaries", () => {
    const r = ["20.15.240.64/26"];
    expect(inRanges("20.15.240.64", r)).toBe(true);
    expect(inRanges("20.15.240.70", r)).toBe(true);
    expect(inRanges("20.15.240.127", r)).toBe(true);
    expect(inRanges("20.15.240.128", r)).toBe(false);
    expect(inRanges("20.15.240.63", r)).toBe(false);
  });
  it("matches IPv6 and IPv4-mapped IPv6", () => {
    expect(inRanges("2001:4860:4801:10::5", ["2001:4860:4801:10::/64"])).toBe(true);
    expect(inRanges("2001:4860:4801:11::5", ["2001:4860:4801:10::/64"])).toBe(false);
    expect(inRanges("::ffff:20.15.240.70", ["20.15.240.64/26"])).toBe(true);
    expect(inRanges("2001:db8::1", ["2001:db8::/32"])).toBe(true);
  });
  it("handles /32, /0 and garbage safely", () => {
    expect(inRanges("1.2.3.4", ["1.2.3.4/32"])).toBe(true);
    expect(inRanges("9.9.9.9", ["1.2.3.4/32"])).toBe(false);
    expect(inRanges("1.2.3.4", ["0.0.0.0/0"])).toBe(true);
    for (const bad of ["", "not-an-ip", "999.1.1.1", "1.2.3", "1.2.3.4/99"]) {
      expect(inRanges(bad, ["1.2.3.0/24"])).toBe(false);
      expect(inRanges("1.2.3.4", [bad])).toBe(false);
    }
  });
});

describe("verify()", () => {
  const gpt = detect("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot")!;
  const claude = detect("compatible; ClaudeBot/1.0")!;
  const ranges = new Map([["gptbot", ["20.15.240.64/26"]]]);
  it("verified when IP is in the vendor ranges", () => expect(verify(gpt, "20.15.240.70", ranges)).toBe("verified"));
  it("unverified (possible spoof) when IP is outside the ranges", () => expect(verify(gpt, "8.8.8.8", ranges)).toBe("unverified"));
  it("unknown when the vendor publishes no ranges or none are loaded", () => {
    expect(verify(claude, "8.8.8.8", ranges)).toBe("unknown");
    expect(verify(gpt, "8.8.8.8", new Map())).toBe("unknown");
    expect(verify(gpt, null, ranges)).toBe("unknown");
  });
});
