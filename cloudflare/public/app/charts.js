// Hand-built SVG charts. Colours come from CSS classes only (CSP forbids inline styles in markup).
// Charts measure their container and re-draw on resize, so text stays a readable size on phones.
const NS = "http://www.w3.org/2000/svg";
export const PURPOSES = ["training", "indexing", "retrieval", "unknown"];
export const LABELS = { training: "Training", indexing: "Search indexing", retrieval: "Answering a person", unknown: "Unclear" };
export const nf = new Intl.NumberFormat("en");

const s = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const kid of kids) el.append(typeof kid === "string" ? document.createTextNode(kid) : kid);
  return el;
};
const div = (cls, text) => Object.assign(document.createElement("div"), { className: cls, textContent: text ?? "" });
const date = (t, opts) => new Intl.DateTimeFormat("en", { timeZone: "UTC", ...opts }).format(new Date(t * 1000));

export function bucketLabel(t, bucket, short) {
  if (bucket === 3600) return date(t, { hour: "2-digit", minute: "2-digit", hour12: false });
  return short ? date(t, { weekday: "short", day: "numeric" }) : date(t, { month: "short", day: "numeric" });
}

function niceMax(v) {
  if (v <= 40) return Math.max(4, Math.ceil(v / 4) * 4);
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 4, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/* Re-render a chart when its container width changes (rotation, resize, drawer). */
const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver((entries) => {
  for (const e of entries) {
    const root = e.target, w = Math.round(e.contentRect.width);
    if (root._render && Math.abs(w - (root._w || 0)) > 8) root._render();
  }
});
function mount(root, render) {
  root._render = render;
  render();
  if (ro && !root._observed) { ro.observe(root); root._observed = true; }
}
export function unmount(root) { root._render = null; }

/* Touch: a tap anywhere outside a chart dismisses its tooltip. */
if (typeof document !== "undefined") {
  document.addEventListener("pointerdown", (e) => {
    document.querySelectorAll(".tip").forEach((t) => { if (!t.parentElement.contains(e.target)) t.hidden = true; });
  }, { passive: true });
}

export function stacked(root, points, bucket) {
  mount(root, () => {
    root.replaceChildren();
    const W = Math.max(200, Math.floor(root.clientWidth || 720));
    root._w = W;
    const H = W < 520 ? 220 : 290, L = 36, R = 6, T = 8, B = 26, pw = W - L - R, ph = H - T - B;
    const n = points.length;
    const totals = points.map((p) => PURPOSES.reduce((a, k) => a + p[k], 0));
    const max = niceMax(Math.max(0, ...totals));
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, class: "enter", role: "group", "aria-label": `Visits per ${bucket === 3600 ? "hour" : "day"}, split by purpose` });
    const axis = s("g", { class: "axis" });
    for (const v of [0, max / 2, max]) {
      const y = T + ph - (v / max) * ph;
      svg.append(s("line", { class: "grid-line", x1: L, x2: W - R, y1: y, y2: y }));
      axis.append(s("text", { x: L - 6, y: y + 4, "text-anchor": "end" }, nf.format(v)));
    }
    const slot = pw / n;
    const step = Math.max(1, Math.ceil(54 / slot)); // keep at least ~54px between x labels
    const tip = div("tip"); tip.hidden = true; tip.setAttribute("role", "presentation");
    const show = (i) => {
      const p = points[i];
      tip.replaceChildren(Object.assign(document.createElement("b"), { textContent: `${bucketLabel(p.t, bucket, false)}: ${nf.format(totals[i])} visits` }));
      for (const k of PURPOSES) if (p[k]) {
        const row = div("row");
        row.append(Object.assign(document.createElement("span"), { textContent: LABELS[k] }), Object.assign(document.createElement("span"), { textContent: nf.format(p[k]) }));
        tip.append(row);
      }
      tip.hidden = false;
      const k = root.clientWidth / W, half = tip.offsetWidth / 2 + 4;
      const x = Math.min(Math.max((L + slot * (i + 0.5)) * k, half), root.clientWidth - half);
      tip.style.setProperty("left", `${x}px`);
      tip.style.setProperty("top", `${Math.max((T + ph - (totals[i] / max) * ph) * k, tip.offsetHeight + 12)}px`);
    };
    points.forEach((p, i) => {
      const bw = Math.max(2, Math.min(28, slot * 0.7));
      const x = L + slot * i + (slot - bw) / 2;
      let y = T + ph;
      for (const k of PURPOSES) {
        if (!p[k]) continue;
        const h = (p[k] / max) * ph;
        y -= h;
        svg.append(s("rect", { class: `seg-rect p-${k}`, x, y, width: bw, height: h }));
      }
      if (i % step === 0) axis.append(s("text", { x: L + slot * (i + 0.5), y: H - 6, "text-anchor": "middle" }, bucketLabel(p.t, bucket, n <= 8)));
      const label = `${bucketLabel(p.t, bucket, false)}: ${totals[i]} visits. ` + PURPOSES.filter((k) => p[k]).map((k) => `${LABELS[k]} ${p[k]}`).join(", ");
      const hit = s("rect", { class: "hit", x: L + slot * i, y: T, width: slot, height: ph, tabindex: "0", role: "img", "aria-label": label });
      hit.addEventListener("pointerdown", () => show(i));
      hit.addEventListener("mouseenter", () => show(i));
      hit.addEventListener("focus", () => show(i));
      hit.addEventListener("mouseleave", () => (tip.hidden = true));
      hit.addEventListener("blur", () => (tip.hidden = true));
      svg.append(hit);
    });
    svg.append(axis);
    root.append(svg, tip);
  });
}

export function heatmap(root, cells) {
  mount(root, () => {
    root.replaceChildren();
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const W = Math.max(200, Math.floor(root.clientWidth || 420)), L = 32, gap = W < 420 ? 2 : 3;
    const cw = Math.max(5, Math.min(22, Math.floor((W - L - 23 * gap) / 24)));
    const H = 7 * (cw + gap) + 16;
    root._w = W;
    const grid = new Map(cells.map((c) => [c.d * 24 + c.h, c.hits]));
    const max = Math.max(0, ...grid.values());
    const readout = Object.assign(document.createElement("p"), { className: "heat-readout muted small", textContent: "Tap or hover a cell for details." });
    readout.setAttribute("aria-live", "polite");
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Visits by weekday and hour, darker means more" });
    const axis = s("g", { class: "axis" });
    for (let d = 0; d < 7; d++) {
      axis.append(s("text", { x: 0, y: d * (cw + gap) + cw - 2 }, days[d]));
      for (let h = 0; h < 24; h++) {
        const n = grid.get(d * 24 + h) ?? 0;
        const lvl = n ? Math.max(1, Math.ceil((n / max) * 5)) : 0;
        const msg = `${days[d]} ${String(h).padStart(2, "0")}:00 UTC: ${nf.format(n)} visits`;
        const cell = s("rect", { class: `cell${lvl ? ` l${lvl}` : ""}`, x: L + h * (cw + gap), y: d * (cw + gap), width: cw, height: cw, rx: 3 }, s("title", {}, msg));
        cell.addEventListener("pointerdown", () => { readout.textContent = msg; });
        cell.addEventListener("mouseenter", () => { readout.textContent = msg; });
        svg.append(cell);
      }
    }
    for (const h of [0, 6, 12, 18]) axis.append(s("text", { x: L + h * (cw + gap), y: H - 2 }, `${String(h).padStart(2, "0")}:00`));
    svg.append(axis);
    root.append(svg, readout);
  });
}
