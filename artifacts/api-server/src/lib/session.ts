import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import { logger } from "./logger";
import { getEmployeeByNetsuiteId } from "./employees";
import { getPrivateKey } from "./netsuite";

// Signed sign-in token, issued by POST /api/auth/login and sent back as
// `Authorization: Bearer <token>`. Before this, the server trusted whatever
// employee id the browser sent, so the NetSuite estimate routes were open to
// anyone with the URL.
const SESSION_DAYS = 30;

let cachedSecret: Buffer | null = null;
function secret(): Buffer {
  if (cachedSecret) return cachedSecret;
  // SESSION_SECRET if the Repl has one; otherwise derived from the NetSuite
  // private key, which is already a deployment secret. Never a constant.
  const source = process.env.SESSION_SECRET?.trim() || `product-selector-session:${getPrivateKey()}`;
  cachedSecret = crypto.createHash("sha256").update(source).digest();
  return cachedSecret;
}

const b64url = (buf: Buffer) => buf.toString("base64url");
const sign = (payload: string) => b64url(crypto.createHmac("sha256", secret()).update(payload).digest());

export function signSession(employeeId: string, now = Date.now()): string {
  const payload = b64url(Buffer.from(JSON.stringify({ e: String(employeeId), x: now + SESSION_DAYS * 86400000 })));
  return `${payload}.${sign(payload)}`;
}

// Returns the employee id, or null when the token is missing, altered or expired.
export function verifySession(token: string | undefined | null, now = Date.now()): string | null {
  if (!token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { e?: unknown; x?: unknown };
    if (typeof data.e !== "string" || !/^-?\d+$/.test(data.e) || typeof data.x !== "number" || data.x < now) return null;
    return data.e;
  } catch {
    return null;
  }
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  return header && /^Bearer\s+/i.test(header) ? header.replace(/^Bearer\s+/i, "").trim() : null;
}

// The employee must still be active in the synced employee list with System
// Access and Webstore Access, as at sign-in.
export async function requireEmployee(req: Request, res: Response, next: NextFunction) {
  const employeeId = verifySession(bearerToken(req));
  if (!employeeId) {
    return res.status(401).json({ error: "Please sign out and sign in again to use NetSuite estimates.", code: "SIGN_IN_REQUIRED" });
  }
  try {
    const emp = await getEmployeeByNetsuiteId(employeeId);
    if (!emp || !emp.giveAccess || !emp.webstoreAccess) {
      return res.status(403).json({ error: "Your account is not authorized to use NetSuite estimates." });
    }
    res.locals.employeeId = employeeId;
    return next();
  } catch (err) {
    logger.error({ err }, "Session check failed");
    return res.status(500).json({ error: "Authorization check failed" });
  }
}
