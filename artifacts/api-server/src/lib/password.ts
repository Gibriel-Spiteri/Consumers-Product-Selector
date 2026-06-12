import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const KEY_LEN = 64;

/**
 * Hashes a plaintext password with scrypt and a random per-password salt.
 * Returns a `${saltHex}:${hashHex}` string suitable for storage.
 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(plain, salt, KEY_LEN)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

/**
 * Verifies a plaintext password against a stored `${saltHex}:${hashHex}` value
 * using a constant-time comparison. Returns false for any malformed/empty hash.
 */
export async function verifyPassword(
  plain: string,
  stored: string | null | undefined
): Promise<boolean> {
  if (!stored) return false;
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;

  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== KEY_LEN) return false;

  const derived = (await scryptAsync(plain, salt, KEY_LEN)) as Buffer;
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
