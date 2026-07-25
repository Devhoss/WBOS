import { createHmac, timingSafeEqual } from "crypto";

const SECRET_KEY = process.env.DOWNLOAD_TOKEN_SECRET ?? process.env.BETTER_AUTH_SECRET!;
const TOKEN_TTL_MS = 5 * 60 * 1000;

export type TokenPayload = {
  invoiceId: string;
  organizationId: string;
  exp: number;
};

export function generateDownloadToken(invoiceId: string, organizationId: string): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload: TokenPayload = { invoiceId, organizationId, exp };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", SECRET_KEY).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyDownloadToken(token: string): TokenPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expectedSig = createHmac("sha256", SECRET_KEY).update(encoded).digest("base64url");
  if (sig.length !== expectedSig.length) return null;

  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
  } catch {
    return null;
  }

  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
  } catch {
    return null;
  }

  if (Date.now() > payload.exp) return null;

  return payload;
}
