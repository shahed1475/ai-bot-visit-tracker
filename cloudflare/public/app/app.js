import { demoApi } from "./demo-data.js";
import { LABELS, PURPOSES, bucketLabel, heatmap, nf, stacked, unmount } from "./charts.js";

const $ = (sel) => document.querySelector(sel);
const h = (tag, props = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "w") el.style.setProperty("--w", String(v));
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
};
const swatch = (p) => h("span", { class: `sw p-${p}`, "aria-hidden": "true" });

const WHY = {
  training: "Collecting pages to train AI models. Block these in robots.txt if you do not want that.",
  indexing: "Building the index that AI search engines cite from. Blocking these can remove you from answers.",
  retrieval: "Fetching your page because someone asked an assistant about it right now.",
  unknown: "Crawlers that do not say why they visit.",
};
const RANGE_WORD = { "24h": "24 hours", "7d": "7 days", "30d": "30 days", "90d": "90 days" };

const DEMO = document.documentElement.dataset.mode === "demo";
const state = { range: "7d", site: "all", ai: true };
try { Object.assign(state, JSON.parse(localStorage.getItem("abt:filters") || "{}")); } catch { /* storage unavailable */ }
if (!RANGE_WORD[state.range]) state.range = "7d";
{
  const fromHash = new URLSearchParams(location.hash.slice(1)).get("range");
  if (RANGE_WORD[fromHash]) state.range = fromHash; // PWA shortcut: /#range=24h
}
const save = () => { try { localStorage.setItem("abt:filters", JSON.stringify(state)); } catch { /* ignore */ } };
const qs = () => new URLSearchParams({ range: state.range, site: state.site, ai: state.ai ? "1" : "0" }).toString();

class Unauthorized extends Error {}
async function api(path, extra = "") {
  if (DEMO) return demoApi(path, state, extra);
  const res = await fetch(`${path}?${qs()}${extra}`, { credentials: "same-origin", headers: { accept: "application/json" } });
  if (res.status === 401) throw new Unauthorized();
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

/* ---------- theme ---------- */
const THEMES = ["auto", "light", "dark"];
const themeMetas = [...document.querySelectorAll('meta[name="theme-color"]')];
const themeOriginal = themeMetas.map((m) => m.content);
const THEME_COLOR = { light: "#eef1f4", dark: "#0e1217" };
function applyTheme(t) {
  if (t === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  themeMetas.forEach((m, i) => { m.content = t === "auto" ? themeOriginal[i] : THEME_COLOR[t]; }); // phone status bar follows the theme
  $("#theme").textContent = `Theme: ${t}`;
}
let theme = "auto";
try { theme = THEMES.includes(localStorage.getItem("abt:theme")) ? localStorage.getItem("abt:theme") : "auto"; } catch { /* ignore */ }
{ const q = new URLSearchParams(location.search).get("theme"); if (THEMES.includes(q)) theme = q; } // ?theme=dark for screenshots and links
applyTheme(theme);
$("#theme").addEventListener("click", () => {
  theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  applyTheme(theme);
  try { localStorage.setItem("abt:theme", theme); } catch { /* ignore */ }
});

/* ---------- formatting ---------- */
const ago = (ts) => {
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};
const iso = (ts) => new Date(ts * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC";
const PHONE_ROWS = 8;
const expanded = new Set();
const phone = () => matchMedia("(max-width: 720px)").matches;
const visibleRows = (key, rows) => (phone() && !expanded.has(key) ? rows.slice(0, PHONE_ROWS) : rows);
const showAll = (key, total, shown, rerender) => total > shown
  ? h("button", { class: "btn more-rows", type: "button", onclick: () => { expanded.add(key); rerender(); } }, `Show all ${total}`) : null;
const empty = (msg) => h("p", { class: "empty" }, msg);
const skeleton = (el) => el.replaceChildren(h("div", { class: "skel" }), h("div", { class: "skel" }), h("div", { class: "skel" }));
const chip = (text, warn) => h("span", { class: `chip${warn ? " warn" : ""}` }, text);
const checkChip = (v) => (v === "verified" ? chip("Verified") : v === "unverified" ? chip("Unverified", true) : null);

/* ---------- panels ---------- */
function renderKpis(s) {
  const noun = state.ai ? "AI visits" : "Bot visits";
  const delta = s.delta == null ? "No earlier period to compare" : `${s.delta > 0 ? "+" : ""}${s.delta}% vs previous ${RANGE_WORD[state.range]}`;
  const share = s.hits ? Math.round((s.byPurpose.retrieval / s.hits) * 100) : 0;
  const items = [
    [noun, nf.format(s.hits), delta],
    ["Bots seen", nf.format(s.bots), `in the last ${RANGE_WORD[state.range]}`],
    ["Pages crawled", nf.format(s.pages), "distinct URLs"],
    ["IP check passed", s.verifiedPct == null ? "n/a" : `${s.verifiedPct}%`,
      s.verifiedPct == null ? "No vendor IP lists apply yet" : s.unverified ? `${nf.format(s.unverified)} visits claimed a bot but came from another IP` : "Every checked visit matched the vendor"],
    ["Answering a person", nf.format(s.byPurpose.retrieval), `${share}% of visits were on behalf of a user`],
  ];
  $("#kpis").replaceChildren(...items.map(([l, v, sub]) => h("div", { class: "kpi" }, h("div", { class: "label" }, l), h("div", { class: "value" }, v), h("div", { class: "sub" }, sub))));
}

function renderTrend(t) {
  const total = t.points.reduce((a, p) => a + PURPOSES.reduce((x, k) => x + p[k], 0), 0);
  if (!total) { unmount($("#trend")); $("#trend").replaceChildren(empty("No visits in this range.")); $("#trend-table").replaceChildren(); return; }
  stacked($("#trend"), t.points, t.bucket);
  const rows = t.points.map((p) => h("tr", {}, h("td", {}, bucketLabel(p.t, t.bucket, false)), ...PURPOSES.map((k) => h("td", { class: "r" }, p[k]))));
  $("#trend-table").replaceChildren(h("div", { class: "scroll" }, h("table", { class: "tbl" },
    h("thead", {}, h("tr", {}, h("th", {}, t.bucket === 3600 ? "Hour (UTC)" : "Day (UTC)"), ...PURPOSES.map((k) => h("th", { class: "r" }, LABELS[k])))),
    h("tbody", {}, rows))));
}

function renderWhy(s) {
  $("#why").replaceChildren(...PURPOSES.map((k) => {
    const n = s.byPurpose[k] ?? 0, pct = s.hits ? Math.round((n / s.hits) * 100) : 0;
    return h("div", { class: `why-row p-${k}` },
      h("div", { class: "why-top" }, swatch(k), h("span", { class: "name" }, LABELS[k]), h("span", { class: "num" }, `${nf.format(n)}`), h("span", { class: "muted small" }, `${pct}%`)),
      h("p", { class: "why-desc" }, WHY[k]),
      h("div", { class: "meter", "aria-hidden": "true" }, h("i", { w: pct })));
  }));
}

function renderBots({ bots }) {
  if (!bots.length) return $("#bots").replaceChildren(empty("No bots in this range."));
  const max = Math.max(...bots.map((b) => b.hits));
  const rows = visibleRows("bots", bots);
  $("#bots").replaceChildren(...rows.map((b) => h("div", { class: `bot p-${b.purpose}` },
    h("div", {}, h("span", { class: "name" }, b.name), h("span", { class: "op" }, `${b.operator}, ${LABELS[b.purpose].toLowerCase()}`),
      b.unverified ? [" ", chip(`${nf.format(b.unverified)} unverified`, true)] : null, b.verified ? [" ", chip(`${nf.format(b.verified)} verified`)] : null),
    h("div", { class: "num" }, nf.format(b.hits)),
    h("div", { class: "meter", "aria-hidden": "true" }, h("i", { w: Math.max(2, (b.hits / max) * 100) })))), showAll("bots", bots.length, rows.length, () => renderBots({ bots })));
}

function renderPages({ pages }) {
  if (!pages.length) return $("#pages").replaceChildren(empty("No pages in this range."));
  $("#pages").replaceChildren(h("div", { class: "scroll" }, h("table", { class: "tbl cards" },
    h("thead", {}, h("tr", {}, h("th", {}, "Page"), h("th", { class: "r" }, "Visits"), h("th", { class: "r" }, "Bots"), h("th", {}, "Purpose mix"))),
    h("tbody", {}, visibleRows("pages", pages).map((p) => h("tr", {},
      h("td", { class: "path c-path" }, p.path),
      h("td", { class: "r c-hits", "data-label": "visits" }, nf.format(p.hits)),
      h("td", { class: "r c-bots", "data-label": p.bots === 1 ? "bot" : "bots" }, p.bots),
      h("td", { class: "c-mix" }, h("div", { class: "mini", role: "img", "aria-label": `Training ${p.training}, indexing ${p.indexing}, retrieval ${p.retrieval}` },
        ["training", "indexing", "retrieval"].map((k) => p[k] ? h("i", { class: `p-${k}`, w: (p[k] / p.hits) * 100 }) : null)))))))),
    showAll("pages", pages.length, visibleRows("pages", pages).length, () => renderPages({ pages })));
}

function renderHeat({ cells }) {
  if (!cells.length) { unmount($("#heat")); return $("#heat").replaceChildren(empty("No visits in this range.")); }
  heatmap($("#heat"), cells);
}

function renderFeed({ visits }, multiSite) {
  if (!visits.length) return $("#feed").replaceChildren(empty("No visits yet."));
  $("#feed").replaceChildren(h("div", { class: "scroll" }, h("table", { class: "tbl cards" },
    h("thead", {}, h("tr", {}, h("th", {}, "When"), h("th", {}, "Bot"), h("th", {}, "Page"), h("th", { class: "r" }, "Status"), h("th", {}, "IP check"), h("th", {}, "Country"))),
    h("tbody", {}, visibleRows("feed", visits).map((v) => h("tr", {},
      h("td", { class: "c-when", title: iso(v.ts) }, ago(v.ts)),
      h("td", { class: "c-bot" }, h("span", { class: `p-${v.purpose}` }, swatch(v.purpose), " "), v.bot_name),
      h("td", { class: "path c-path" }, multiSite ? `${v.site}${v.path}` : v.path),
      h("td", { class: "r c-status" }, v.status ?? ""), h("td", { class: "c-check" }, checkChip(v.verified)), h("td", { class: "c-country" }, v.country ?? "")))))),
    showAll("feed", visits.length, visibleRows("feed", visits).length, () => renderFeed({ visits }, multiSite)));
}

function renderSetup(hasSites) {
  $("#setup").replaceChildren(
    h("h2", {}, hasSites ? "Waiting for the first AI bot visit" : "Add your first site"),
    h("p", { class: "muted" }, hasSites
      ? "Your site is ready. Visits appear here as soon as it reports one. Setup takes a few minutes."
      : "A site is a website you want to watch. You get a private key for it, then connect it with the edge sensor or your server code."),
    h("a", { class: "btn primary link-btn", href: hasSites ? "/docs/" : "/app/settings/" }, hasSites ? "Open the setup guide" : "Add a site"),
    hasSites ? h("a", { class: "btn link-btn", href: "/app/settings/" }, "Manage sites and keys") : null);
}

/* ---------- loading ---------- */
let loading = false;
async function load(quiet = false) {
  if (loading) return;
  loading = true;
  const panels = ["#trend", "#why", "#bots", "#pages", "#heat", "#feed"];
  if (!quiet) panels.forEach((p) => skeleton($(p)));
  try {
    const recentQs = "&limit=25";
    const jobs = [api("/api/summary"), api("/api/timeseries"), api("/api/bots"), api("/api/pages"), api("/api/heatmap"), api("/api/recent", recentQs)];
    const res = await Promise.allSettled(jobs);
    if (res.some((r) => r.status === "rejected" && r.reason instanceof Unauthorized)) return showLogin();
    const [sum, ts, bots, pages, heat, recent] = res;
    const fail = (sel) => $(sel).replaceChildren(empty("Could not load this panel. Press Refresh to retry."));
    $("#banner").hidden = !res.some((r) => r.status === "rejected");
    if ($("#banner").hidden === false) $("#banner").textContent = "Some panels failed to load. The rest are up to date.";

    if (sum.status === "fulfilled") {
      const s = sum.value;
      syncSites(s.sites);
      const none = s.sites.length === 0 || (s.hits === 0 && s.prevHits === 0 && state.site === "all");
      $("#setup").hidden = !none; $("#grid").hidden = none; $("#kpis").hidden = none;
      if (none) renderSetup(s.sites.length > 0); else { renderKpis(s); renderWhy(s); }
      $("#legend").replaceChildren(...PURPOSES.slice(0, 4).map((k) => h("li", {}, swatch(k), LABELS[k])));
      if (!none) {
        const multi = s.sites.length > 1 && state.site === "all";
        trend(ts); b(bots); p(pages); hm(heat); fd(recent, multi);
      }
    } else { ["#why", ...panels].forEach(fail); }
    function trend(r) { r.status === "fulfilled" ? renderTrend(r.value) : fail("#trend"); }
    function b(r) { r.status === "fulfilled" ? renderBots(r.value) : fail("#bots"); }
    function p(r) { r.status === "fulfilled" ? renderPages(r.value) : fail("#pages"); }
    function hm(r) { r.status === "fulfilled" ? renderHeat(r.value) : fail("#heat"); }
    function fd(r, m) { r.status === "fulfilled" ? renderFeed(r.value, m) : fail("#feed"); }
    $("#updated").textContent = `Updated ${new Date().toISOString().slice(11, 19)} UTC.`;
  } finally { loading = false; }
}

function syncSites(sites) {
  const sel = $("#site");
  if (state.site !== "all" && !sites.some((s) => String(s.id) === state.site)) state.site = "all";
  sel.replaceChildren(h("option", { value: "all" }, "All sites"), ...sites.map((s) => h("option", { value: String(s.id) }, s.hostname)));
  sel.value = state.site;
  sel.hidden = sites.length < 2;
}

function syncControls() {
  document.querySelectorAll("#ranges button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.range === state.range)));
  $("#ai-only").checked = state.ai;
  const q = qs();
  $("#export-csv").href = `/api/export.csv?${q}`;
  $("#export-json").href = `/api/export.json?${q}`;
}

function showLogin() { location.replace("/login?next=" + encodeURIComponent(location.pathname)); }
async function showApp() {
  $("#app").hidden = false; syncControls();
  if (DEMO) $("#demo-banner").hidden = new URLSearchParams(location.search).has("shot");
  await load();
  if (location.hash === "#feed") $("#p-feed").scrollIntoView();
}

document.querySelectorAll("#ranges button").forEach((btn) => btn.addEventListener("click", () => { state.range = btn.dataset.range; save(); syncControls(); load(); }));
$("#site").addEventListener("change", (e) => { state.site = e.target.value; save(); syncControls(); load(); });
$("#ai-only").addEventListener("change", (e) => { state.ai = e.target.checked; save(); syncControls(); load(); });
$("#refresh").addEventListener("click", () => load());
$("#logout").addEventListener("click", async () => { if (!DEMO) await fetch("/api/auth/logout", { method: "POST" }); location.assign("/"); });
if (DEMO) { $("#logout").hidden = true; $("#settings").hidden = true; }
setInterval(() => { if (!document.hidden && !$("#app").hidden) load(true); }, 60_000);

/* ---------- phone menu ---------- */
const menuBtn = $("#menu-btn"), more = $("#more");
const setMenu = (open) => { more.classList.toggle("open", open); menuBtn.setAttribute("aria-expanded", String(open)); };
menuBtn.addEventListener("click", () => setMenu(!more.classList.contains("open")));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
document.addEventListener("pointerdown", (e) => { if (!more.contains(e.target) && !menuBtn.contains(e.target)) setMenu(false); }, { passive: true });
more.addEventListener("click", (e) => { if (e.target.closest("a, button:not(#theme)")) setMenu(false); });

/* ---------- bottom tab bar: highlight the section in view ---------- */
{
  const tabs = [...document.querySelectorAll(".tabbar a")];
  const targets = tabs.map((a) => document.querySelector(a.getAttribute("href")));
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) {
        tabs.forEach((t) => t.removeAttribute("aria-current"));
        tabs[targets.indexOf(en.target)]?.setAttribute("aria-current", "true");
      }
    }, { rootMargin: "-40% 0px -55% 0px" });
    targets.forEach((t) => t && io.observe(t));
  }
}

/* ---------- installable app (PWA), offline banner ---------- */
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
{
  let deferred = null;
  const installBtn = $("#install");
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; installBtn.hidden = false; });
  installBtn.addEventListener("click", async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => {});
    deferred = null; installBtn.hidden = true;
  });
  window.addEventListener("appinstalled", () => { installBtn.hidden = true; $("#ios-hint").hidden = true; });
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  $("#ios-hint").hidden = !(ios && !standalone);
}
{
  const banner = $("#offline");
  const sync = () => { banner.hidden = navigator.onLine; };
  window.addEventListener("online", () => { sync(); if (!$("#app").hidden) load(true); });
  window.addEventListener("offline", sync);
  sync();
}

(async () => {
  try {
    if (DEMO) return void (await showApp());
    const s = await (await fetch("/api/auth/me", { credentials: "same-origin" })).json();
    s.authenticated ? await showApp() : showLogin();
  } catch {
    // Network failure (offline or server down): do not guess that the user is signed out.
    $("#app").hidden = false; syncControls();
    $("#kpis").hidden = true; $("#grid").hidden = true; $("#setup").hidden = true;
    if (navigator.onLine) { // offline already has its own banner
      $("#banner").textContent = "Cannot reach the server. Data will load when you are back online.";
      $("#banner").hidden = false;
    }
  }
})();
