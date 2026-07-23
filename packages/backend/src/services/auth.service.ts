import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sign(payload: string): string {
  return createHmac("sha256", env.authSecret).update(payload).digest("base64url");
}

export function issueToken(email: string): string {
  const payloadB64 = Buffer.from(JSON.stringify({ email, exp: Date.now() + TOKEN_TTL_MS })).toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verifyToken(token: string): { email: string } | null {
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;

  const expected = Buffer.from(sign(payloadB64));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const { email, exp } = JSON.parse(Buffer.from(payloadB64, "base64url").toString()) as {
      email: string;
      exp: number;
    };
    if (!email || !exp || Date.now() > exp) return null;
    return { email };
  } catch {
    return null;
  }
}
