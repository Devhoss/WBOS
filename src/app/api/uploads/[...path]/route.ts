import { readFile } from "fs/promises";
import { join, resolve, sep } from "path";
import { existsSync } from "fs";
import { NextResponse } from "next/server";

import { prisma } from "@/infrastructure/database/prisma";
import { apiContext } from "@/infrastructure/request/api-context";
import { BusinessError } from "@/shared/errors/business-error";
import { STORAGE_ROOT, PUBLIC_ROOT as FALLBACK_ROOT } from "@/infrastructure/storage/storage-root";
import { SIGNED_INVOICE_PREFIX } from "@/domains/sales/signed-invoice-storage";

const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  ico: "image/x-icon",
  pdf: "application/pdf",
};

/** Marks the tenant-private subtrees. Everything under them requires ownership. */
const ATTACHMENT_PREFIX = `uploads${sep}attachments${sep}`;

/**
 * Resolve a candidate to a real absolute path and confirm it stays inside
 * `root`. Returns null when the candidate escapes the root, which is what
 * makes traversal impossible regardless of how the URL was encoded.
 */
function resolveWithin(root: string, ...segments: string[]): string | null {
  const rootResolved = resolve(root);
  const candidate = resolve(join(rootResolved, ...segments));
  if (candidate !== rootResolved && !candidate.startsWith(rootResolved + sep)) {
    return null;
  }
  return candidate;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;

  if (!path || path.length === 0) {
    return new NextResponse(null, { status: 400 });
  }

  const requested = path.join("/");

  // Resolve the file FIRST, then decide authorization from the resolved
  // location. Deciding from the URL string allowed the same file to be reached
  // by a path form that failed the prefix test (e.g. dropping "uploads/"),
  // which skipped the session check entirely.
  const roots = FALLBACK_ROOT === STORAGE_ROOT ? [STORAGE_ROOT] : [STORAGE_ROOT, FALLBACK_ROOT];

  let filePath: string | null = null;
  let owningRoot: string | null = null;

  outer: for (const root of roots) {
    for (const prefix of ["uploads", ""]) {
      const candidate = prefix
        ? resolveWithin(root, prefix, requested)
        : resolveWithin(root, requested);
      if (candidate && existsSync(candidate)) {
        filePath = candidate;
        owningRoot = resolve(root);
        break outer;
      }
    }
  }

  if (!filePath || !owningRoot) {
    return new NextResponse(null, { status: 404 });
  }

  // Storage-relative key, e.g. "uploads/attachments/<org>/<type>/<id>/<file>".
  const relativeKey = filePath.slice(owningRoot.length + 1);
  const isAttachment = relativeKey.startsWith(ATTACHMENT_PREFIX);
  const isSignedInvoice = relativeKey.startsWith(SIGNED_INVOICE_PREFIX);

  if (isSignedInvoice) {
    // A customer's signed proof of delivery. Same rule as an attachment: prove
    // a session, then prove this organization owns the file.
    let organizationId: string;
    try {
      const auth = await apiContext(request.headers);
      if (!auth.ok) return new NextResponse(null, { status: 401 });
      organizationId = auth.context.organizationId;
    } catch {
      return new NextResponse(null, { status: 401 });
    }

    const storagePath = `/api/uploads/${relativeKey.split(sep).join("/")}`;
    const owned = await prisma.salesOrder.findFirst({
      where: { organizationId, signedInvoicePath: storagePath, archivedAt: null },
      select: { id: true },
    });

    // Indistinguishable from missing, so the endpoint cannot be used to probe
    // for another organization's documents.
    if (!owned) {
      return new NextResponse(null, { status: 404 });
    }
  }

  if (isAttachment) {
    // Tenant-private: require a session AND prove this org owns the file.
    let organizationId: string;
    try {
      const auth = await apiContext(request.headers);
      if (!auth.ok) return auth.response;
      const context = auth.context;
      organizationId = context.organizationId;
    } catch (error) {
      if (error instanceof BusinessError) {
        return new NextResponse(null, { status: 404 });
      }
      return new NextResponse(null, { status: 401 });
    }

    // storageKey is always stored with forward slashes.
    const storageKey = relativeKey.split(sep).join("/");
    const owned = await prisma.attachment.findFirst({
      where: { organizationId, storageKey, archivedAt: null },
      select: { id: true },
    });

    // Indistinguishable from "missing" so the endpoint cannot be used to probe
    // for the existence of another organization's documents.
    if (!owned) {
      return new NextResponse(null, { status: 404 });
    }
  }

  try {
    const buffer = await readFile(filePath);
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        // Tenant documents must never enter a shared cache. Public assets
        // (logos) stay long-lived because PDF rendering fetches them without
        // cookies.
        "Cache-Control": isAttachment
          ? "private, no-store"
          : "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
