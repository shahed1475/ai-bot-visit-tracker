// Operator tool (there is no email service, so no "forgot password" email).
//   node scripts/admin.mjs reset-password user@example.com "new password here" [--local]
//   node scripts/admin.mjs users [--local]
// Runs against the remote database unless --local is given. Needs `npx wrangler login` for remote.
import { execFileSync } from "node:child_process";
import { pbkdf2Sync, randomBytes } from "node:crypto";

const args = process.argv.slice(2).filter((a) => a !== "--local");
const target = process.argv.includes("--local") ? "--local" : "--remote";
const [cmd, email, password] = args;
const run = (sql) => execFileSync("npx", ["wrangler", "d1", "execute", "ai-bot-tracker", target, "--command", sql], { stdio: "inherit" });

if (cmd === "users") run("SELECT id, email, datetime(created_at,'unixepoch') AS created FROM users ORDER BY id");
else if (cmd === "reset-password" && email && password) {
  if (password.length < 10 || password.length > 128) throw new Error("Password must be 10 to 128 characters.");
  const salt = randomBytes(16);
  const hash = `pbkdf2-sha256$100000$${salt.toString("base64")}$${pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("base64")}`;
  const e = email.toLowerCase().replace(/'/g, "''");
  run(`UPDATE users SET password_hash = '${hash}' WHERE email = '${e}'; DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = '${e}');`);
  console.log(`Password reset for ${email}. Their sessions were signed out.`);
} else { console.error("Usage: admin.mjs users | admin.mjs reset-password <email> <new password> [--local]"); process.exit(1); }
