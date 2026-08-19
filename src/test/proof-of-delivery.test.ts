import { beforeAll, describe, expect, it } from "vitest";

import {
  POD_MAX_BYTES,
  describePodFileRejection,
  isAllowedPodMimeType,
} from "@/domains/sales/proof-of-delivery";
import type { TokenKind } from "@/lib/download/signed-token";

/**
 * The signing key is read once when the token module is first evaluated, so it
 * has to be in place before the import happens — hence the dynamic import
 * rather than a static one.
 */
let generateDownloadToken: (id: string, org: string, kind?: TokenKind) => string;
let verifyDownloadToken: (token: string) => { invoiceId: string; organizationId: string; kind?: TokenKind } | null;

beforeAll(async () => {
  process.env.DOWNLOAD_TOKEN_SECRET = "test-download-token-secret";
  const tokens = await import("@/lib/download/signed-token");
  generateDownloadToken = tokens.generateDownloadToken;
  verifyDownloadToken = tokens.verifyDownloadToken;
});

/**
 * The parts of proof of delivery that decide whether a file is accepted and
 * whether a download link may be used. Both are gates, so both are worth
 * testing away from the database.
 */

describe("accepted proof-of-delivery file types", () => {
  it("accepts what a phone camera and a scanner actually produce", () => {
    for (const mime of [
      "image/jpeg",
      "image/png",
      "image/heic",
      "image/heif",
      "image/webp",
      "application/pdf",
    ]) {
      expect(isAllowedPodMimeType(mime)).toBe(true);
    }
  });

  it("accepts HEIC, which is what an iPhone produces by default", () => {
    // Worth stating on its own: an allow-list built from "jpg and png" quietly
    // rejects every photo taken on a default-configured iPhone.
    expect(isAllowedPodMimeType("image/heic")).toBe(true);
  });

  it("ignores case and parameters in the content type", () => {
    expect(isAllowedPodMimeType("IMAGE/JPEG")).toBe(true);
    expect(isAllowedPodMimeType("image/jpeg; charset=binary")).toBe(true);
  });

  it("rejects anything else", () => {
    for (const mime of [
      "application/x-msdownload",
      "text/html",
      "application/zip",
      "video/mp4",
      "",
    ]) {
      expect(isAllowedPodMimeType(mime)).toBe(false);
    }
  });
});

describe("why an upload was refused", () => {
  it("passes an ordinary photo", () => {
    expect(describePodFileRejection("image/jpeg", 2 * 1024 * 1024)).toBeNull();
  });

  it("explains an unsupported type in terms the driver can act on", () => {
    const message = describePodFileRejection("video/mp4", 1024);
    expect(message).toMatch(/photos/i);
    expect(message).toMatch(/PDF/);
  });

  it("refuses an empty file", () => {
    expect(describePodFileRejection("image/jpeg", 0)).toMatch(/empty/i);
  });

  it("refuses a file over the size limit and names the limit", () => {
    const message = describePodFileRejection("image/jpeg", POD_MAX_BYTES + 1);
    expect(message).toMatch(/10 MB/);
  });

  it("accepts a file exactly at the limit", () => {
    expect(describePodFileRejection("image/jpeg", POD_MAX_BYTES)).toBeNull();
  });
});

describe("proof-of-delivery download tokens", () => {
  it("round-trips the document and organization", () => {
    const token = generateDownloadToken("doc-1", "org-1", "pod-document");
    const payload = verifyDownloadToken(token);

    expect(payload).not.toBeNull();
    expect(payload!.invoiceId).toBe("doc-1");
    expect(payload!.organizationId).toBe("org-1");
    expect(payload!.kind).toBe("pod-document");
  });

  it("keeps kinds distinct, so an invoice token cannot fetch a delivery photo", () => {
    // The download route checks `kind`. If tokens were interchangeable, any
    // invoice link would also unlock a customer's signed paperwork.
    const invoiceToken = verifyDownloadToken(generateDownloadToken("id-1", "org-1", "invoice"));
    const podToken = verifyDownloadToken(generateDownloadToken("id-1", "org-1", "pod-document"));

    expect(invoiceToken!.kind).toBe("invoice");
    expect(podToken!.kind).toBe("pod-document");
    expect(invoiceToken!.kind).not.toBe(podToken!.kind);
  });

  it("rejects a tampered token", () => {
    const token = generateDownloadToken("doc-1", "org-1", "pod-document");
    const [encoded, signature] = token.split(".");

    // Swap the organization and keep the original signature.
    const forged = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8")),
        organizationId: "org-attacker",
      }),
    ).toString("base64url");

    expect(verifyDownloadToken(`${forged}.${signature}`)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = generateDownloadToken("doc-1", "org-1", "pod-document");
    const original = Date.now;
    try {
      Date.now = () => original() + 10 * 60 * 1000;
      expect(verifyDownloadToken(token)).toBeNull();
    } finally {
      Date.now = original;
    }
  });
});
