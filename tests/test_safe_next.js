// The login "next" parameter must only ever lead to a path on this site (no open redirect).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const src = fs.readFileSync(path.join(__dirname, "..", "cloudflare", "public", "safe-next.js"), "utf8");
const safeNext = new Function("URL", `${src.replace(/export\s+function/, "function")}\nreturn safeNext;`)(URL);
const ORIGIN = "https://tracker.test";
const run = (v) => safeNext(v, ORIGIN);

test("keeps same-site paths, queries and hashes", () => {
  assert.strictEqual(run("/app/settings/"), "/app/settings/");
  assert.strictEqual(run("/app/?range=7d#x"), "/app/?range=7d#x");
});
test("falls back to /app/ when empty or missing", () => {
  assert.strictEqual(run(null), "/app/");
  assert.strictEqual(run(""), "/app/");
});
test("rejects every way of leaving the site", () => {
  for (const bad of [
    "//evil.com", "/\\evil.com", "\\\\evil.com", "\\/evil.com", "/\\/evil.com", "/%5Cevil.com",
    "https://evil.com", "http://evil.com/x", "javascript:alert(1)", "evil.com", "/\tevil.com", "/\nevil.com",
    "/\r/evil.com", "/\u0000evil.com", " //evil.com", "/ /evil.com",
    // dot segments that normalise into a protocol-relative path
    "/.//evil.com", "/a/..//evil.com", "/././/evil.com", "/..//evil.com", "/%2e//evil.com", "/.%2e//evil.com", "/a/%2e%2e//evil.com",
  ]) assert.strictEqual(run(bad), "/app/", JSON.stringify(bad));
});
test("the result is always a single-slash path on this site", () => {
  for (const v of ["/a/../b", "/./c?x=1", "/app/../app/", "/a//b"]) {
    const out = run(v);
    assert.ok(out.startsWith("/") && !out.startsWith("//"), `${v} -> ${out}`);
    assert.strictEqual(new URL(out, ORIGIN).origin, ORIGIN);
  }
});
