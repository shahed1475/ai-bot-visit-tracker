import { BOTS } from "./registry";

const MAX_RANGE_BYTES = 2 * 1024 * 1024;
type Fetch = typeof fetch;

async function fetchPrefixes(url: string, fetchFn: Fetch): Promise<string[] | null> {
  try {
    const res = await fetchFn(url, { signal: AbortSignal.timeout(10_000), headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.length > MAX_RANGE_BYTES) return null;
    const body = JSON.parse(text) as { prefixes?: Array<{ ipv4Prefix?: string; ipv6Prefix?: string }> };
    if (!Array.isArray(body.prefixes)) return null;
    return body.prefixes.map((p) => p.ipv4Prefix ?? p.ipv6Prefix).filter((c): c is string => typeof c === "string");
  } catch {
    return null;
  }
}

/**
 * Bring a bot's stored ranges in line with what its sources published, writing only the difference.
 * Nothing is replaced unless at least one source answered, and unchanged ranges are never touched, so a
 * failed batch cannot leave a bot with no ranges and an unchanged list costs no D1 writes.
 */
export async function refreshIpRanges(env: Pick<Env, "DB">, fetchFn: Fetch = fetch) {
  const updated: string[] = [];
  const failed: string[] = [];
  let added = 0;
  let removed = 0;
  for (const bot of BOTS) {
    if (bot.ipSources.length === 0) continue;
    const found = new Set<string>();
    let anyOk = false;
    for (const src of bot.ipSources) {
      const list = await fetchPrefixes(src, fetchFn);
      if (list) { anyOk = true; list.forEach((c) => found.add(c)); }
    }
    if (!anyOk || found.size === 0) { failed.push(bot.id); continue; }
    const { results } = await env.DB.prepare("SELECT cidr FROM ip_ranges WHERE bot_id = ?").bind(bot.id).all<{ cidr: string }>();
    const have = new Set(results.map((r) => r.cidr));
    const toAdd = [...found].filter((c) => !have.has(c));
    const toRemove = [...have].filter((c) => !found.has(c));
    const ins = env.DB.prepare("INSERT OR IGNORE INTO ip_ranges (bot_id, cidr) VALUES (?, ?)");
    const del = env.DB.prepare("DELETE FROM ip_ranges WHERE bot_id = ? AND cidr = ?");
    // Additions first: the bot is never short of ranges between batches.
    const stmts = [...toAdd.map((c) => ins.bind(bot.id, c)), ...toRemove.map((c) => del.bind(bot.id, c))];
    for (let i = 0; i < stmts.length; i += 100) await env.DB.batch(stmts.slice(i, i + 100));
    added += toAdd.length;
    removed += toRemove.length;
    updated.push(bot.id);
  }
  await env.DB.prepare("INSERT INTO meta (key,value) VALUES ('ranges_refreshed_at',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .bind(String(Math.floor(Date.now() / 1000))).run();
  return { updated, failed, added, removed };
}

/** Deletes old rows in chunks of 1000 (large single deletes can time out). */
export async function purgeOld(env: Pick<Env, "DB">, days: number) {
  const cutoff = Math.floor(Date.now() / 1000) - Math.max(1, days) * 86400;
  let visits = 0;
  for (let i = 0; i < 200; i++) {
    const r = await env.DB.prepare("DELETE FROM visits WHERE id IN (SELECT id FROM visits WHERE ts < ? LIMIT 1000)").bind(cutoff).run();
    const n = r.meta.changes ?? 0;
    visits += n;
    if (n < 1000) break;
  }
  await env.DB.batch([
    env.DB.prepare("DELETE FROM visit_hourly WHERE hour < ?").bind(cutoff),
    env.DB.prepare("DELETE FROM meta WHERE key LIKE 'login%' OR key LIKE 'signup%'"),
    env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(Math.floor(Date.now() / 1000)),
  ]);
  return { visits };
}

export async function runScheduled(env: Env) {
  const days = Number(env.RETENTION_DAYS) || 90;
  for (const [name, job] of [["ranges", () => refreshIpRanges(env)], ["purge", () => purgeOld(env, days)]] as const) {
    try { console.log(JSON.stringify({ msg: "cron", job: name, result: await job() })); }
    catch (err) { console.error(JSON.stringify({ msg: "cron_failed", job: name, error: String(err) })); }
  }
}
