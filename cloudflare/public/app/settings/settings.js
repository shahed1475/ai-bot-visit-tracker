const $ = (s) => document.querySelector(s);
const h = (tag, props = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) { if (v == null || v === false) continue; if (k === "class") el.className = v; else if (k.startsWith("on")) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? "" : v); }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
};
const ERR = { invalid_hostname: "Enter a hostname like example.com, without https:// or a path.", site_exists: "You already added this site.", site_limit: "You have reached the limit of 5 sites.",
  invalid_credentials: "That password is not correct.", weak_password: "Use a password of 10 to 128 characters." };
const say = (el, msg, good) => { el.textContent = msg; el.hidden = false; el.classList.toggle("ok", !!good); };
async function api(path, method = "GET", body) {
  const res = await fetch(path, { method, headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401 && !path.startsWith("/api/auth/password") && !path.startsWith("/api/auth/account")) location.replace("/login?next=/app/settings/");
  return { res, data: await res.json().catch(() => ({})) };
}
const ago = (ts) => { if (!ts) return "No visits yet"; const s = Date.now() / 1000 - ts; return s < 3600 ? `Last visit ${Math.max(1, Math.floor(s / 60))} min ago` : s < 86400 ? `Last visit ${Math.floor(s / 3600)} h ago` : `Last visit ${Math.floor(s / 86400)} d ago`; };
const origin = location.origin;

function keyPanel(hostname, key) {
  const copy = (text, btn) => async () => { try { await navigator.clipboard.writeText(text); btn.textContent = "Copied"; } catch { btn.textContent = "Press and hold to copy"; } };
  const sensor = `TRACKER_URL = ${origin}\nTRACKER_KEY = ${key}`;
  const b1 = h("button", { class: "btn", type: "button" }, "Copy key"); b1.addEventListener("click", copy(key, b1));
  const b2 = h("button", { class: "btn", type: "button" }, "Copy sensor settings"); b2.addEventListener("click", copy(sensor, b2));
  $("#key-area").replaceChildren(h("div", { class: "key-panel", role: "status" },
    h("strong", {}, `Key for ${hostname}. Copy it now, it is shown only once.`),
    h("code", {}, key), h("div", { class: "row-actions" }, b1, b2, h("a", { class: "btn link-btn", href: "/docs/" }, "Open the setup guide")),
    h("p", { class: "hint" }, "Lost it? Rotate the key. The old one stops working immediately.")));
}

async function loadSites() {
  const { data } = await api("/api/sites");
  const sites = data.sites ?? [];
  $("#site-count").textContent = `${sites.length} of ${data.max ?? 5}`;
  $("#sites").replaceChildren(...(sites.length ? sites.map((s) => h("div", { class: "site-row" },
    h("div", {}, h("div", { class: "name" }, s.hostname), h("div", { class: "meta" }, `Key ${s.keyPrefix}... · ${ago(s.lastVisit)}`)),
    h("div", { class: "row-actions" },
      h("button", { class: "btn", type: "button", onclick: async () => { if (!confirm(`Rotate the key for ${s.hostname}? The old key stops working now.`)) return; const r = await api(`/api/sites/${s.id}/rotate-key`, "POST"); if (r.res.ok) { keyPanel(s.hostname, r.data.key); loadSites(); } } }, "Rotate key"),
      h("button", { class: "btn danger", type: "button", onclick: async () => { if (!confirm(`Delete ${s.hostname} and all its recorded visits? This cannot be undone.`)) return; await api(`/api/sites/${s.id}`, "DELETE"); loadSites(); } }, "Delete")))) : [h("p", { class: "empty" }, "No sites yet. Add the first website you want to watch.")]));
}

$("#add-site").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#site-error").hidden = true;
  const hostname = $("#hostname").value.trim();
  const { res, data } = await api("/api/sites", "POST", { hostname });
  if (!res.ok) return say($("#site-error"), ERR[data.error] ?? "Could not add the site. Try again.");
  $("#hostname").value = "";
  keyPanel(data.site.hostname, data.key);
  loadSites();
});
$("#pw-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const { res, data } = await api("/api/auth/password", "POST", { current: $("#cur").value, next: $("#new").value });
  if (res.ok) { $("#cur").value = ""; $("#new").value = ""; return say($("#pw-msg"), "Password changed. Other devices were signed out.", true); }
  say($("#pw-msg"), ERR[data.error] ?? "Could not change the password.");
});
$("#del-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!confirm("Delete your account, all sites and all visits? This cannot be undone.")) return;
  const { res, data } = await api("/api/auth/account", "DELETE", { password: $("#del-pw").value });
  if (res.ok) return location.assign("/");
  say($("#del-msg"), ERR[data.error] ?? "Could not delete the account.");
});
$("#logout").addEventListener("click", async () => { await api("/api/auth/logout", "POST"); location.assign("/"); });

(async () => {
  const me = await (await fetch("/api/auth/me")).json();
  if (!me.authenticated) return location.replace("/login?next=/app/settings/");
  $("#email").textContent = me.email;
  if (new URLSearchParams(location.search).get("welcome")) $("#welcome").hidden = false;
  loadSites();
})();
