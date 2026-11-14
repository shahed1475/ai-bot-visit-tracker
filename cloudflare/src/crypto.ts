const enc = new TextEncoder();

async function sha256(s: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", enc.encode(s));
}

/** Constant-time string comparison (hashes first so lengths never leak). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([sha256(a), sha256(b)]);
  return crypto.subtle.timingSafeEqual(ha, hb);
}

const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

export async function sign(secret: string, payload: string): Promise<string> {
  return b64url(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(payload)));
}

export async function sha256Hex(s: string): Promise<string> {
  return [...new Uint8Array(await sha256(s))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** URL-safe random token from n random bytes (n=32 gives 43 characters). */
export function randomToken(n = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(n)).buffer as ArrayBuffer);
}
