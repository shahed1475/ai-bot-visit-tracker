const path = require('path');
const BotDetector = require('../../core/bot-detector');
const Classifier = require('../../core/classifier');
const Database = require('../../core/database');
const { Reporter } = require('../../core/reporter');

const SENSITIVE_HEADERS = new Set(['authorization', 'cookie', 'set-cookie', 'x-api-key', 'x-auth-token', 'proxy-authorization']);

/**
 * AI Bot Visit Tracker for Express (and anything with (req, res, next)).
 *
 * Options:
 *   database: { type: 'sqlite', path } | false     local storage (default: ./data/bot_visits.db); false disables it
 *   report:   { endpoint, key, site }              also send visits to the Cloudflare tracker
 *   skipNonBots (true), asyncLogging (true), enableLogging (true), addHeaders (false), headerPrefix
 *   customBotPatterns: [{ id, name, pattern, kind, purpose }], ipRanges: { botId: [cidr] }
 *   trustCloudflareHeaders (false): use CF-Connecting-IP as the client IP (only if you sit behind Cloudflare)
 */
class AiBotTracker {
    constructor(options = {}) {
        this.options = {
            database: options.database === false ? false : { type: 'sqlite', path: path.join(process.cwd(), 'data', 'bot_visits.db'), ...(options.database || {}) },
            report: options.report || null,
            skipNonBots: options.skipNonBots !== false,
            asyncLogging: options.asyncLogging !== false,
            enableLogging: options.enableLogging !== false,
            addHeaders: options.addHeaders === true,
            headerPrefix: options.headerPrefix || 'X-Bot-Tracker-',
            trustCloudflareHeaders: options.trustCloudflareHeaders === true
        };
        this.botDetector = new BotDetector({ customPatterns: options.customBotPatterns, ipRanges: options.ipRanges });
        this.classifier = new Classifier();
        this.database = this.options.database ? new Database(this.options.database) : null;
        this.reporter = this.options.report ? new Reporter(this.options.report) : null;
        this.initialized = false;
        this._init = null;
    }

    initialize() {
        if (!this._init) {
            this._init = (async () => {
                if (this.database) await this.database.connect();
                this.initialized = true;
                if (this.options.enableLogging) console.log('[AiBotTracker] ready');
            })().catch((err) => { this._init = null; throw err; });
        }
        return this._init;
    }

    clientIp(req) {
        if (this.options.trustCloudflareHeaders && req.headers['cf-connecting-ip']) return String(req.headers['cf-connecting-ip']);
        return req.ip || (req.socket && req.socket.remoteAddress) || (req.connection && req.connection.remoteAddress) || '';
    }

    middleware() {
        return async (req, res, next) => {
            try {
                if (!this.initialized) await this.initialize();
                const ip = this.clientIp(req);
                const info = this.botDetector.detectBot(req.get ? req.get('User-Agent') : req.headers['user-agent'], ip);
                if (!info.isBot && this.options.skipNonBots) return next();
                req.botInfo = info;
                if (info.isBot) {
                    const started = Date.now(); // per request: never shared on the instance
                    const snapshot = this.snapshot(req, ip);
                    if (this.options.addHeaders) {
                        res.setHeader(`${this.options.headerPrefix}Detected`, 'true');
                        res.setHeader(`${this.options.headerPrefix}Bot-Name`, info.botName);
                    }
                    res.once('finish', () => {
                        const job = this.record(snapshot, info, res.statusCode, Date.now() - started);
                        if (!this.options.asyncLogging) return job;
                        job.catch(() => {});
                    });
                }
            } catch (err) {
                if (this.options.enableLogging) console.error('[AiBotTracker] error:', err.message);
            }
            next();
        };
    }

    snapshot(req, ip) {
        const headers = {};
        for (const [k, v] of Object.entries(req.headers || {})) if (!SENSITIVE_HEADERS.has(k.toLowerCase())) headers[k] = v;
        const host = req.get ? req.get('host') : req.headers.host;
        return { ip, headers, method: req.method, url: (req.originalUrl || req.url || '/').split(/[?#]/)[0], host,
            pageUrl: `${req.protocol || 'http'}://${host}${(req.originalUrl || req.url || '/').split(/[?#]/)[0]}`,
            ua: (req.get ? req.get('User-Agent') : req.headers['user-agent']) || '', referer: (req.get ? req.get('Referer') : req.headers.referer) || '' };
    }

    async record(s, info, status, ms) {
        try {
            const c = this.classifier.classifyRequest({ userAgent: s.ua, headers: s.headers, url: s.url, ipAddress: s.ip,
                referer: s.referer, purpose: info.purpose, botName: info.botName });
            if (this.database) {
                await this.database.logVisit({ ipAddress: s.ip, botId: info.botId, botName: info.botName, botKind: info.kind, pageUrl: s.pageUrl,
                    headers: s.headers, classification: c.classification, verified: info.verified, userAgent: s.ua, referer: s.referer,
                    requestMethod: s.method, responseStatus: status, processingTimeMs: ms });
            }
            if (this.reporter) this.reporter.add({ ip: s.ip, ua: s.ua, path: s.url, method: s.method, status, referer: s.referer.split(/[?#]/)[0] || undefined }); // query strings never leave the server
        } catch (err) {
            if (this.options.enableLogging) console.error('[AiBotTracker] record failed:', err.message);
        }
    }

    /** Express handler for GET /ai-bot-tracker/stats (protect it behind your own auth). */
    statsHandler() {
        return async (_req, res) => {
            try { res.json({ bots: await this.getStats() }); } catch { res.status(500).json({ error: 'stats unavailable' }); }
        };
    }

    async getStats() { await this.initialize(); return this.database ? this.database.getBotStats() : []; }
    async getRecentVisits(limit = 50) { await this.initialize(); return this.database ? this.database.getRecentVisits(limit) : []; }
    async exportToJson(filters = {}) { await this.initialize(); return this.database ? this.database.exportToJSON(filters) : []; }
    async cleanup(days = 90) { await this.initialize(); return this.database ? this.database.cleanupOldVisits(days) : 0; }

    async close() {
        if (this.reporter) await this.reporter.flush();
        if (this.database) await this.database.close();
        this.initialized = false;
        this._init = null;
    }
}

const createAiBotTracker = (options = {}) => new AiBotTracker(options);
const quickSetup = (app, options = {}) => { const t = createAiBotTracker(options); app.use(t.middleware()); return t; };

module.exports = { AiBotTracker, createAiBotTracker, quickSetup };
