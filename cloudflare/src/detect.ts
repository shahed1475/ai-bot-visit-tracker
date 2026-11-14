import { inRanges } from "./cidr";
import { COMPILED, type Bot, type Kind, type Purpose } from "./registry";

export interface Match {
  id: string;
  name: string;
  operator: string;
  kind: Kind;
  purpose: Purpose;
  ipSources: string[];
}
export type Verified = "verified" | "unverified" | "unknown";

const MAX_UA = 512;
const GENERIC = /[a-z]bot\b|\bbot\b|\b(crawler|spider|scraper|fetcher|indexer)\b/i;

const toMatch = (b: Bot): Match => ({
  id: b.id, name: b.name, operator: b.operator, kind: b.kind, purpose: b.purpose, ipSources: b.ipSources,
});

/** First registry entry (file order) whose regex matches wins; unknown crawlers fall back to "generic-bot". */
export function detect(userAgent: string | null | undefined): Match | null {
  if (!userAgent) return null;
  const ua = userAgent.slice(0, MAX_UA);
  for (const { bot, re } of COMPILED) if (re.test(ua)) return toMatch(bot);
  if (GENERIC.test(ua)) {
    return { id: "generic-bot", name: "Other crawler", operator: "Unknown", kind: "other", purpose: "unknown", ipSources: [] };
  }
  return null;
}

/** ranges: bot id -> CIDR list loaded from the vendor-published files. */
export function verify(match: Match, ip: string | null | undefined, ranges: Map<string, string[]>): Verified {
  if (!ip || match.ipSources.length === 0) return "unknown";
  const list = ranges.get(match.id);
  if (!list || list.length === 0) return "unknown";
  return inRanges(ip, list) ? "verified" : "unverified";
}
