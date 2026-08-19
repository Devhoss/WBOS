import { createHmac, timingSafeEqual } from "crypto";

const SECRET_KEY = process.env.DOWNLOAD_TOKEN_SECRET ?? process.env.BETTER_AUTH_SECRET!;
const TOKEN_TTL_MS = 5 * 60 * 1000;

/**
 * `kind` distinguishes what the token grants. It is optional so that tokens
 * minted before it existed still verify, and absent means "invoice" -- the only
 * thing these tokens used to unlock.
 */
export type TokenKind = "invoice" | "signed-invoice";

export type TokenPayload = {
  invoiceId: string;
  organizationId: string;
  exp: number;
  kind?: TokenKind;
};

export function generateDownloadToken(
  invoiceId: string,
  organizationId: string,
  kind: TokenKind = "invoice",
): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload: TokenPayload = { invoiceId, organizationId, exp, kind };
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

  return { ...payload, kind: payload.kind ?? "invoice" };
}
