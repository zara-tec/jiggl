import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Secrets at rest (the SMTP password of a workspace) are encrypted with a key
 * derived from AUTH_SECRET, so no extra variable is needed. Rotating
 * AUTH_SECRET makes them unreadable: they have to be entered again.
 */
function key() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET is missing or too short (set it in .env)");
  return createHash("sha256").update(s).digest();
}

/** AES-256-GCM: "gcm$<iv>$<tag>$<ciphertext>", all hex */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["gcm", iv.toString("hex"), cipher.getAuthTag().toString("hex"), data.toString("hex")].join("$");
}

export function decryptSecret(stored: string): string {
  const [algo, iv, tag, data] = stored.split("$");
  if (algo !== "gcm" || !iv || !tag || data === undefined) throw new Error("Unrecognised secret format");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "hex"));
    decipher.setAuthTag(Buffer.from(tag, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(data, "hex")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("The stored secret cannot be read (was AUTH_SECRET changed?): enter it again");
  }
}
