import crypto from "crypto";

const COOKIE_NAME = "otb_admin";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function makeToken(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("ADMIN_PASSWORD not set");
  return crypto.createHmac("sha256", password).update("otb:admin:session").digest("hex");
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const expected = makeToken();
    const a = Buffer.from(token.padEnd(64, "0").slice(0, 64), "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function checkPassword(input: string): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(password);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export { COOKIE_NAME, COOKIE_MAX_AGE, makeToken };
