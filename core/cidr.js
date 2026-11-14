/** IPv4/IPv6 CIDR matching on BigInt. IPv4-mapped IPv6 (::ffff:a.b.c.d) is treated as IPv4. */
function parseV4(s) {
    const parts = s.split('.');
    if (parts.length !== 4) return null;
    let n = 0n;
    for (const p of parts) {
        if (!/^\d{1,3}$/.test(p) || Number(p) > 255) return null;
        n = (n << 8n) | BigInt(p);
    }
    return n;
}

function parseV6(input) {
    let s = input.split('%')[0];
    if (s.includes('.')) {
        const i = s.lastIndexOf(':');
        const v4 = parseV4(s.slice(i + 1));
        if (v4 === null) return null;
        s = `${s.slice(0, i + 1)}${(v4 >> 16n).toString(16)}:${(v4 & 0xffffn).toString(16)}`;
    }
    const halves = s.split('::');
    if (halves.length > 2) return null;
    const head = halves[0] ? halves[0].split(':') : [];
    const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
    if (halves.length === 1 && head.length !== 8) return null;
    if (halves.length === 2 && head.length + rest.length > 7) return null;
    const groups = halves.length === 1 ? head : [...head, ...Array(8 - head.length - rest.length).fill('0'), ...rest];
    let n = 0n;
    for (const g of groups) {
        if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
        n = (n << 16n) | BigInt(parseInt(g, 16));
    }
    return n;
}

function parseAddr(ip) {
    if (ip.includes(':')) {
        const n = parseV6(ip);
        if (n === null) return null;
        return n >> 32n === 0xffffn ? { v: 4, n: n & 0xffffffffn } : { v: 6, n };
    }
    const n = parseV4(ip);
    return n === null ? null : { v: 4, n };
}

function parseCidr(c) {
    const [addr, len, extra] = String(c).split('/');
    if (!addr || len === undefined || extra !== undefined || !/^\d{1,3}$/.test(len)) return null;
    const a = parseAddr(addr);
    return a && Number(len) <= (a.v === 4 ? 32 : 128) ? { ...a, len: Number(len) } : null;
}

function inRanges(ip, cidrs) {
    if (!ip) return false;
    const a = parseAddr(String(ip).trim());
    if (!a) return false;
    const bits = a.v === 4 ? 32n : 128n;
    for (const c of cidrs) {
        const r = parseCidr(c);
        if (!r || r.v !== a.v) continue;
        const shift = bits - BigInt(r.len);
        if (a.n >> shift === r.n >> shift) return true;
    }
    return false;
}

module.exports = { inRanges };
