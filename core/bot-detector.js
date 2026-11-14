/**
 * AI bot detection driven by the shared registry (signatures/ai-bots.json).
 * Matching contract (identical in every language): first registry entry whose
 * case-insensitive `ua` regex matches wins; unknown crawlers fall back to "generic-bot".
 */
const registry = require('../signatures/ai-bots.json');
const { inRanges } = require('./cidr');

const MAX_UA = 512;
const GENERIC = /[a-z]bot\b|\bbot\b|\b(crawler|spider|scraper|fetcher|indexer)\b/i;
const NOT_BOT = { isBot: false, botId: null, botName: null, operator: null, kind: null, purpose: null, verified: 'unknown', confidence: 0, method: null };

class BotDetector {
    /**
     * @param {Object} [options]
     * @param {Object<string,string[]>} [options.ipRanges] bot id -> CIDR list (vendor published ranges)
     * @param {Array<{id,name,pattern,kind?,purpose?,operator?}>} [options.customPatterns] checked before the registry
     */
    constructor(options = {}) {
        this.entries = registry.bots.map((b) => ({ ...b, re: new RegExp(b.ua, 'i') }));
        this.custom = [];
        this.ipRanges = options.ipRanges || {};
        for (const c of options.customPatterns || []) this.addBotPattern(c.name || c.id, c.pattern, c);
    }

    addBotPattern(botName, pattern, opts = {}) {
        const re = pattern instanceof RegExp ? new RegExp(pattern.source, 'i') : new RegExp(String(pattern), 'i');
        this.custom.push({ id: opts.id || String(botName).toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: botName,
            operator: opts.operator || 'Custom', kind: opts.kind || 'ai', purpose: opts.purpose || 'unknown', ipSources: [], re });
    }

    setIpRanges(ranges) { this.ipRanges = ranges || {}; }

    getSupportedBots() { return registry.bots.filter((b) => b.kind === 'ai').map((b) => b.name); }

    /** @returns {{isBot:boolean,botId:?string,botName:?string,operator:?string,kind:?string,purpose:?string,verified:string,confidence:number,method:?string}} */
    detectBot(userAgent, ipAddress) {
        if (!userAgent || typeof userAgent !== 'string') return { ...NOT_BOT };
        const ua = userAgent.slice(0, MAX_UA);
        for (const e of [...this.custom, ...this.entries]) {
            if (e.re.test(ua)) return this.result(e, ipAddress, 0.95, 'user-agent');
        }
        if (GENERIC.test(ua)) {
            return this.result({ id: 'generic-bot', name: 'Other crawler', operator: 'Unknown', kind: 'other', purpose: 'unknown', ipSources: [] }, ipAddress, 0.5, 'generic-pattern');
        }
        return { ...NOT_BOT };
    }

    result(e, ip, confidence, method) {
        const list = this.ipRanges[e.id];
        const verified = !ip || !e.ipSources || e.ipSources.length === 0 || !list || list.length === 0
            ? 'unknown' : inRanges(ip, list) ? 'verified' : 'unverified';
        return { isBot: true, botId: e.id, botName: e.name, operator: e.operator, kind: e.kind, purpose: e.purpose, verified, confidence, method };
    }

    /** Download the vendor-published IP lists (Node 18+). Failures leave existing ranges untouched. */
    async refreshIpRanges(fetchFn = fetch) {
        const updated = [];
        for (const b of registry.bots) {
            if (!b.ipSources.length) continue;
            const found = new Set();
            for (const src of b.ipSources) {
                try {
                    const res = await fetchFn(src, { signal: AbortSignal.timeout(10000) });
                    if (!res.ok) continue;
                    for (const p of (await res.json()).prefixes || []) if (p.ipv4Prefix || p.ipv6Prefix) found.add(p.ipv4Prefix || p.ipv6Prefix);
                } catch { /* keep previous ranges */ }
            }
            if (found.size) { this.ipRanges[b.id] = [...found]; updated.push(b.id); }
        }
        return updated;
    }
}

module.exports = BotDetector;
