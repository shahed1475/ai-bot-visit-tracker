/**
 * Local SQLite storage for the Node middleware.
 * (Central, multi-site storage lives in the Cloudflare tracker: see cloudflare/README.md.)
 */
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class Database {
    constructor(config = {}) {
        this.config = {
            type: config.type || 'sqlite',
            path: config.path || config.sqlitePath || path.join(process.cwd(), 'data', 'bot_visits.db')
        };
        this.db = null;
        this.isConnected = false;
    }

    async connect() {
        if (this.config.type !== 'sqlite') {
            throw new Error(`Unsupported database type "${this.config.type}". The Node middleware stores locally in SQLite; ` +
                'to centralise data use the report option with the Cloudflare tracker.');
        }
        fs.mkdirSync(path.dirname(this.config.path), { recursive: true });
        await new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.config.path, (err) => (err ? reject(err) : resolve()));
        });
        await this.exec('PRAGMA journal_mode = WAL;');
        await this.exec(fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8'));
        this.isConnected = true;
    }

    exec(sql) { return new Promise((res, rej) => this.db.exec(sql, (e) => (e ? rej(e) : res()))); }
    run(sql, params = []) {
        return new Promise((res, rej) => this.db.run(sql, params, function (e) { return e ? rej(e) : res({ lastID: this.lastID, changes: this.changes }); }));
    }
    all(sql, params = []) { return new Promise((res, rej) => this.db.all(sql, params, (e, rows) => (e ? rej(e) : res(rows)))); }
    get(sql, params = []) { return new Promise((res, rej) => this.db.get(sql, params, (e, row) => (e ? rej(e) : res(row)))); }

    async logVisit(v) {
        try {
            const r = await this.run(
                `INSERT INTO visits (ip_address, bot_id, bot_name, bot_kind, page_url, headers, classification, verified,
                    user_agent, referer, request_method, response_status, processing_time_ms)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                [v.ipAddress, v.botId || null, v.botName || null, v.botKind || null, v.pageUrl,
                    typeof v.headers === 'string' ? v.headers : JSON.stringify(v.headers || {}),
                    v.classification || 'unknown', v.verified || 'unknown', v.userAgent, v.referer,
                    v.requestMethod || 'GET', v.responseStatus ?? null, v.processingTimeMs ?? null]);
            return { success: true, visitId: r.lastID };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /** Per-bot totals, computed from the visits table. */
    async getBotStats(botName = null) {
        return this.all(
            `SELECT bot_name, COUNT(*) AS total_visits,
                SUM(classification = 'training') AS training_visits,
                SUM(classification = 'indexing') AS indexing_visits,
                SUM(classification = 'retrieval') AS retrieval_visits,
                MIN(timestamp) AS first_visit, MAX(timestamp) AS last_visit
             FROM visits WHERE bot_name IS NOT NULL ${botName ? 'AND bot_name = ?' : ''}
             GROUP BY bot_name ORDER BY total_visits DESC`, botName ? [botName] : []);
    }
    getStats(...a) { return this.getBotStats(...a); }

    getRecentVisits(limit = 100, offset = 0) {
        return this.all('SELECT * FROM visits ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?', [Math.max(1, Math.min(+limit || 100, 1000)), Math.max(0, +offset || 0)]);
    }

    getVisitsByClassification(classification, limit = 100) {
        return this.all('SELECT * FROM visits WHERE classification = ? ORDER BY timestamp DESC LIMIT ?', [classification, limit]);
    }

    getVisitStats(startDate, endDate) {
        return this.all(
            `SELECT bot_name, classification, COUNT(*) AS count, COUNT(DISTINCT ip_address) AS unique_ips, COUNT(DISTINCT page_url) AS unique_pages
             FROM visits WHERE timestamp BETWEEN ? AND ? GROUP BY bot_name, classification ORDER BY count DESC`, [startDate, endDate]);
    }

    async exportToJSON(filters = {}) {
        const where = ['1=1'], params = [];
        if (filters.botName) { where.push('bot_name = ?'); params.push(filters.botName); }
        if (filters.classification) { where.push('classification = ?'); params.push(filters.classification); }
        if (filters.startDate) { where.push('timestamp >= ?'); params.push(filters.startDate); }
        if (filters.endDate) { where.push('timestamp <= ?'); params.push(filters.endDate); }
        params.push(Math.min(+filters.limit || 10000, 100000));
        const rows = await this.all(`SELECT * FROM visits WHERE ${where.join(' AND ')} ORDER BY timestamp DESC LIMIT ?`, params);
        return rows.map((r) => ({ ...r, headers: JSON.parse(r.headers || '{}') }));
    }

    async cleanupOldVisits(retentionDays = 90) {
        const days = Math.max(1, Math.floor(Number(retentionDays) || 90));
        return (await this.run('DELETE FROM visits WHERE timestamp < datetime(\'now\', ?)', [`-${days} days`])).changes;
    }

    close() {
        return new Promise((resolve) => {
            if (!this.db) return resolve();
            this.db.close(() => { this.isConnected = false; resolve(); });
        });
    }

    isReady() { return this.isConnected; }
}

module.exports = Database;
