// TS port of scripts/lib/encryption.mjs (itself a port of recallsync-app's
// src/utils/encryption.ts). MUST stay byte-compatible: same algorithm
// (aes-256-cbc), same key derivation (sha256 of ENCRYPTION_KEY), same envelope
// ("<ivHex>:<cipherHex>"). Server-only — relies on process.env.ENCRYPTION_KEY,
// which Next.js loads automatically (no dotenv).
import crypto from "node:crypto";

const algorithm = "aes-256-cbc";

function getKey() {
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set (add it to .env.local)");
  }
  // sha256 the secret to guarantee a 32-byte key for AES-256.
  return crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, getKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(":");
  if (parts.length !== 2) {
    throw new Error(
      'Invalid encrypted data format (expected "<ivHex>:<cipherHex>")',
    );
  }
  const iv = Buffer.from(parts[0], "hex");
  const decipher = crypto.createDecipheriv(algorithm, getKey(), iv);
  let decrypted = decipher.update(parts[1], "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// Heuristic: does a stored value look like our envelope (32 hex IV : hex)?
// Lets callers fall back to treating non-matching values as legacy plaintext.
export function isEncrypted(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{32}:[0-9a-f]+$/i.test(value);
}
