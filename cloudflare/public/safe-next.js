// Turns the login "next" parameter into a same-site path, or "/app/". Anything that could leave the site is refused.
export function safeNext(value, origin) {
  const fallback = "/app/";
  if (typeof value !== "string" || value === "" || value.length > 2000) return fallback;
  // Backslashes and control characters are read as "/" by browsers, so "/\evil.com" would mean "//evil.com".
  // Spaces are refused too: browsers strip some of them, which can turn "/ /x" into "//x".
  if (/[\\\s\u0000-\u001f\u007f]/.test(value) || /%5c/i.test(value)) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  let u;
  try { u = new URL(value, origin); } catch { return fallback; }
  if (u.origin !== origin) return fallback;
  return u.pathname + u.search + u.hash;
}
