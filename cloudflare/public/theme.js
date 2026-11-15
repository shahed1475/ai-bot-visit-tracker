// Light / dark / auto theme for every page except the dashboard and demo (they ship their own button).
// Shares the saved choice (localStorage "abt:theme") with the dashboard. Classic script in <head>: applies before first paint.
(() => {
  const THEMES = ["auto", "light", "dark"], KEY = "abt:theme", root = document.documentElement;
  const COLOR = { light: "#eef1f4", dark: "#0e1217" };
  const metas = [...document.querySelectorAll('meta[name="theme-color"]')], original = metas.map((m) => m.content);
  let theme = "auto";
  try { const s = localStorage.getItem(KEY); if (THEMES.includes(s)) theme = s; } catch { /* storage blocked */ }
  const apply = (t) => {
    if (t === "auto") delete root.dataset.theme; else root.dataset.theme = t;
    metas.forEach((m, i) => { m.content = t === "auto" ? original[i] : COLOR[t]; });
  };
  // <picture> sources follow the OS setting only. When the user forces light or dark, pick the matching screenshot ourselves.
  const pictures = () => [...document.querySelectorAll("picture")].map((pic) => ({ img: pic.querySelector("img"), src: pic.querySelector('source[data-media], source[media*="dark"]') })).filter((x) => x.img && x.src);
  const syncImages = () => {
    for (const { img, src } of pictures()) {
      src.dataset.media ??= src.media; img.dataset.light ??= img.getAttribute("src"); src.dataset.dark ??= src.getAttribute("srcset");
      if (theme === "auto") { src.media = src.dataset.media; if (img.getAttribute("src") !== img.dataset.light) img.setAttribute("src", img.dataset.light); continue; }
      src.media = "not all";
      const want = theme === "dark" ? src.dataset.dark : img.dataset.light;
      if (img.getAttribute("src") !== want) img.setAttribute("src", want);
    }
  };
  apply(theme);
  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.createElement("button");
    btn.type = "button";
    const label = () => { btn.textContent = `Theme: ${theme}`; btn.setAttribute("aria-label", `Colour theme: ${theme}. Press to change.`); };
    btn.className = "btn theme-btn";
    btn.addEventListener("click", () => {
      theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
      apply(theme); syncImages(); label();
      try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
    });
    label(); syncImages();
    const nav = document.querySelector("header nav, nav.nav");
    if (nav) nav.append(btn); else { btn.classList.add("theme-fab"); document.body.append(btn); }
  });
})();
