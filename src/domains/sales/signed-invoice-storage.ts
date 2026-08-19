import { join, sep } from "path";

/**
 * Where a customer-signed proof of delivery lives.
 *
 * These were written into `public/uploads/` and recorded as `/uploads/<name>`,
 * which is Next's static directory: served to anyone who can reach the host,
 * with no session check at all. The filename embedded the SO number and a
 * `uid()` built from `Date.now()` plus eight `Math.random` characters, so it was
 * not an unguessable token either. They also sat outside the storage root, and
 * therefore outside the backup path.
 *
 * They now live under the storage root behind the authenticated uploads route,
 * partitioned by organization so ownership is checkable from the path alone.
 */
export const SIGNED_INVOICE_DIR = "signed-invoices";

/** Marks the subtree in a resolved filesystem path. */
export const SIGNED_INVOICE_PREFIX = `uploads${sep}${SIGNED_INVOICE_DIR}${sep}`;

export function signedInvoiceStorageDir(storageRoot: string, organizationId: string): string {
  return join(storageRoot, "uploads", SIGNED_INVOICE_DIR, organizationId);
}

/** The value stored in `SalesOrder.signedInvoicePath`, and the URL that serves it. */
export function signedInvoicePath(organizationId: string, fileName: string): string {
  return `/api/uploads/uploads/${SIGNED_INVOICE_DIR}/${organizationId}/${fileName}`;
}

/**
 * Legacy rows point at `/uploads/<name>` in the public directory. They are
 * still readable so nothing breaks for orders already delivered, but they are
 * not protected -- see docs for the one-off move.
 */
export function isLegacyPublicPath(path: string | null | undefined): boolean {
  return !!path && path.startsWith("/uploads/");
}

/**
 * Warn when the resolved storage root sits inside Next's public directory.
 *
 * `WBOS_STORAGE_ROOT` falls back to `public/`, and anything under `public/` is
 * ALSO served statically with no authentication — so on that fallback the
 * authenticated route is not the only way in. Production sets the variable, so
 * this is a development-only trap, but it is exactly the shape of the bug being
 * fixed here and should not be silent.
 */
export function warnIfStorageRootIsPublic(storageRoot: string): void {
  const normalized = storageRoot.split(sep).join("/");
  if (!normalized.endsWith("/public")) return;
  console.warn(
    "[signed-invoice] WBOS_STORAGE_ROOT is unset, so uploads land in public/ and are " +
      "also reachable without a session at /uploads/…. Set WBOS_STORAGE_ROOT outside public/.",
  );
}
