// Login and signup forms. Both pages load this file; data-mode on <body> picks the endpoint.
import { safeNext } from "/safe-next.js";
const $ = (s) => document.querySelector(s);
const mode = document.body.dataset.mode;
const next = safeNext(new URLSearchParams(location.search).get("next"), location.origin);
const MESSAGES = {
  invalid_credentials: "That email or password is not correct.",
  email_taken: "An account with this email already exists. Try signing in instead.",
  invalid_email: "Enter a valid email address.",
  weak_password: "Use a password of 10 to 128 characters.",
  too_many_attempts: "Too many attempts. Try again in an hour.",
  captcha_failed: "The spam check failed. Reload the page and try again.",
};
const err = $("#error");
const show = (m) => { err.textContent = m; err.hidden = false; err.focus?.(); };

(async () => { // already signed in? skip the form
  try { if ((await (await fetch("/api/auth/me")).json()).authenticated) location.replace(next); } catch { /* offline */ }
})();

let turnstileToken = "";
(async () => {
  if (mode !== "signup") return;
  try {
    const { turnstileSiteKey } = await (await fetch("/api/config")).json();
    if (!turnstileSiteKey) return;
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; s.async = true;
    s.onload = () => window.turnstile.render("#turnstile", { sitekey: turnstileSiteKey, callback: (t) => { turnstileToken = t; } });
    document.head.append(s);
  } catch { /* spam check is optional */ }
})();

$("#form").addEventListener("submit", async (e) => {
  e.preventDefault();
  err.hidden = true;
  const btn = $("#submit"); btn.disabled = true;
  const body = { email: $("#email").value, password: $("#password").value };
  if (mode === "signup") { body.website = $("#website").value; body.turnstileToken = turnstileToken; }
  try {
    const res = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) return location.assign(mode === "signup" ? "/app/settings/?welcome=1" : next);
    const { error } = await res.json().catch(() => ({}));
    show(MESSAGES[error] ?? "Something went wrong. Try again.");
  } catch { show("Cannot reach the server. Check your connection and try again."); }
  btn.disabled = false;
});
