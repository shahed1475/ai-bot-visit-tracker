import { DurableObject } from "cloudflare:workers";

/**
 * Password hashing lives in a Durable Object because PBKDF2 at a safe cost takes ~40 ms of CPU,
 * far above the 10 ms Workers free-plan limit (Durable Objects allow 30 s). It holds no state.
 */
const ITERATIONS = 100_000; // the maximum Workers' Web Crypto supports
const enc = new TextEncoder();
const toB64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}

export class PasswordHasher extends DurableObject<Env> {
  async hash(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return `pbkdf2-sha256$${ITERATIONS}$${toB64(salt)}$${toB64(await derive(password, salt, ITERATIONS))}`;
  }

  async verify(password: string, stored: string): Promise<boolean> {
    try {
      const [alg, iter, salt, hash] = stored.split("$");
      const n = Number(iter);
      if (alg !== "pbkdf2-sha256" || !Number.isInteger(n) || n < 10_000 || n > ITERATIONS || !salt || !hash) return false;
      const expected = fromB64(hash);
      const actual = await derive(password, fromB64(salt), n);
      return expected.length === actual.length && crypto.subtle.timingSafeEqual(expected, actual);
    } catch {
      return false;
    }
  }
}
