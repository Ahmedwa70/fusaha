import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

// AES-256-GCM: authenticated encryption (tampering with the ciphertext or
// swapping rows fails decryption instead of returning garbage), standard
// Node `crypto` — no extra dependency. APP_KEY is the operator-held secret;
// it never touches the DB, only its derived 32-byte key does.
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

let cachedKey: Buffer | null = null;

function getDerivedKey(): Buffer {
  if (!cachedKey) {
    const appKey = process.env.APP_KEY;
    if (!appKey) throw new Error("APP_KEY is not set");
    cachedKey = scryptSync(appKey, "system-settings-secret-box", 32);
  }
  return cachedKey;
}

// Encoded as "iv.authTag.ciphertext", each part base64 — a single text
// column value, safe to store as-is in `system_settings.encrypted_value`.
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getDerivedKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(".");
}

export function decryptSecret(payload: string): string {
  const [ivB64, authTagB64, ciphertextB64] = payload.split(".");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted secret payload");
  }
  const decipher = createDecipheriv(ALGORITHM, getDerivedKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
