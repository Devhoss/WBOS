/**
 * Proof of delivery — the shape of the document set, shared by both clients.
 *
 * Signed delivery paperwork is photographed page by page with the phone's
 * ordinary Camera app, so a two-page invoice arrives as two images and a
 * delivery may carry extra documents besides. The set therefore belongs to the
 * *delivery* (a shipment), not to the sales order: an order that ships twice
 * has two sets of signed paperwork, and flattening them onto the order would
 * lose which signature covers which drop.
 *
 * The sales order is only the place you look them up from.
 *
 * Storage reuses `Attachment` rather than introducing a table of its own. That
 * is not an economy — it is the ownership check. `/api/uploads/[...path]`
 * already resolves the file first and then proves the caller's organization
 * owns the matching `attachments` row, answering 404 rather than 403 so the
 * endpoint cannot be used to probe another tenant's documents. A second store
 * would need a second copy of that reasoning, and the copy is where the bug
 * would live.
 */

/** Attachments are keyed by entity; a delivery is a shipment. */
export const POD_ENTITY_TYPE = "SHIPMENT";

/** Photographs from a phone, plus the occasional scanned PDF. */
export const POD_ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
  "application/pdf",
]);

/**
 * Phone cameras produce a few megabytes per page; 10 MB matches the limit the
 * other upload paths already use, so a file that is acceptable on the web form
 * is acceptable from the handset.
 */
export const POD_MAX_BYTES = 10 * 1024 * 1024;

/**
 * A ceiling exists so a stuck retry loop cannot fill the disk. Generous
 * relative to the real case — a two-page invoice plus a photo of the pallet.
 */
export const POD_MAX_DOCUMENTS_PER_DELIVERY = 25;

export type ProofOfDeliveryDocument = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** 1-based page position within this delivery's set. */
  pageNumber: number;
  /** Authenticated URL; never a public path. */
  url: string;
  uploadedAt: string;
  uploadedBy: { id: string; name: string | null } | null;
};

export type ProofOfDeliverySet = {
  shipmentId: string;
  shipmentNumber: string;
  status: string;
  deliveredAt: string | null;
  documents: ProofOfDeliveryDocument[];
};

export type ProofOfDeliveryView = {
  salesOrderId: string;
  soNumber: string;
  deliveries: ProofOfDeliverySet[];
  /**
   * The single pre-POD signed invoice, when one was uploaded before this
   * feature existed. Read-only and shown separately: the file is real and must
   * keep working, but it predates page ordering and has no delivery to hang
   * off, so it is not folded into a set and pretended to be page 1.
   */
  legacySignedInvoicePath: string | null;
};

export function isAllowedPodMimeType(mimeType: string): boolean {
  return POD_ALLOWED_MIME_TYPES.has(mimeType.toLowerCase().split(";")[0].trim());
}

/**
 * Why an upload was refused, phrased for the person holding the phone.
 * Returns null when the file is acceptable.
 */
export function describePodFileRejection(
  mimeType: string,
  sizeBytes: number,
): string | null {
  if (!isAllowedPodMimeType(mimeType)) {
    return "Only photos (JPG, PNG, HEIC, WEBP) and PDF files can be attached as proof of delivery.";
  }
  if (sizeBytes <= 0) {
    return "That file is empty.";
  }
  if (sizeBytes > POD_MAX_BYTES) {
    return `Each document must be under ${Math.floor(POD_MAX_BYTES / (1024 * 1024))} MB.`;
  }
  return null;
}
