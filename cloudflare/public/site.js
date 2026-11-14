// Small progressive enhancements for the public pages.
for (const el of document.querySelectorAll(".js-origin")) el.textContent = location.origin;
(async () => { // signed in? point the buttons at the dashboard
  try {
    const me = await (await fetch("/api/auth/me")).json();
    if (!me.authenticated) return;
    for (const a of document.querySelectorAll(".js-cta")) { a.textContent = "Open dashboard"; a.href = "/app/"; }
    for (const a of document.querySelectorAll(".js-signin")) a.hidden = true;
  } catch { /* offline or logged out */ }
})();
