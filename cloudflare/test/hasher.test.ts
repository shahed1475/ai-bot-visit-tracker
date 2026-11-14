import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("PasswordHasher durable object", () => {
  it("hashes with a random salt and verifies only the right password", async () => {
    const h = env.HASHER.getByName("t");
    const a = await h.hash("correct horse battery");
    const b = await h.hash("correct horse battery");
    expect(a).toMatch(/^pbkdf2-sha256\$100000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(a).not.toBe(b);
    expect(await h.verify("correct horse battery", a)).toBe(true);
    expect(await h.verify("wrong horse battery", a)).toBe(false);
  });
  it("returns false for malformed stored hashes instead of throwing", async () => {
    const h = env.HASHER.getByName("t");
    for (const bad of ["", "plain", "pbkdf2-sha256$1$x", "bcrypt$10$a$b"]) expect(await h.verify("x", bad)).toBe(false);
  });
});
