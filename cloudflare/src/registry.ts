import data from "../../signatures/ai-bots.json";

export type Kind = "ai" | "search" | "social" | "other";
export type Purpose = "training" | "indexing" | "retrieval" | "unknown";

export interface Bot {
  id: string;
  name: string;
  operator: string;
  kind: Kind;
  purpose: Purpose;
  ua: string;
  robots: string;
  ipSources: string[];
  docs: string;
}

export const BOTS = data.bots as Bot[];
export const COMPILED = BOTS.map((bot) => ({ bot, re: new RegExp(bot.ua, "i") }));
