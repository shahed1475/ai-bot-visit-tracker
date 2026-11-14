/**
 * Reports bot visits to the Cloudflare tracker (POST {endpoint}/api/ingest).
 * Fire-and-forget: it batches events, times out quickly and NEVER throws into your app.
 */
class Reporter {
    constructor({ endpoint, key, site, timeoutMs = 2000, flushMs = 2000, maxBatch = 50, maxQueue = 1000 } = {}) {
        if (!endpoint || !key || !site) throw new Error('Reporter needs endpoint, key and site');
        this.url = `${String(endpoint).replace(/\/+$/, '')}/api/ingest`;
        Object.assign(this, { key, site, timeoutMs, flushMs, maxBatch, maxQueue });
        this.queue = [];
        this.timer = null;
    }

    /** Queue one event ({ip, ua, path, method, status, referer}). */
    add(event) {
        if (this.queue.length >= this.maxQueue) this.queue.shift();
        this.queue.push(event);
        if (this.flushMs === 0 || this.queue.length >= this.maxBatch) return void this.flush();
        if (!this.timer) { this.timer = setTimeout(() => this.flush(), this.flushMs); this.timer.unref(); }
    }

    async flush() {
        clearTimeout(this.timer); this.timer = null;
        const batch = this.queue.splice(0, this.maxBatch);
        if (batch.length) await this.send(batch);
        if (this.queue.length) return this.flush();
    }

    /** @returns {Promise<boolean>} true when the tracker accepted the batch */
    async send(events) {
        try {
            const body = JSON.stringify({ events: events.map((e) => ({ site: this.site, ...e })) });
            const res = await fetch(this.url, {
                method: 'POST', body, signal: AbortSignal.timeout(this.timeoutMs),
                headers: { authorization: `Bearer ${this.key}`, 'content-type': 'application/json' }
            });
            return res.ok;
        } catch {
            return false;
        }
    }
}

module.exports = { Reporter };
