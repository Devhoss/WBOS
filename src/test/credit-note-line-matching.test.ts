import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreditNoteService } from "@/domains/credit-notes/services/credit-note-service";
import { prisma } from "@/infrastructure/database/prisma";

/**
 * Credit notes must never match invoice lines by productId alone.
 *
 * `new Map(invoiceLines.map((il) => [il.productId, il.id]))` collapses an order
 * that carries the same product twice — the standing WBOS pattern of a NORMAL
 * paid line plus a FREE_SAMPLE line — and a Map keeps the LAST entry, so every
 * credit was attributed to the zero-priced free-sample line. Worse, that lookup
 * took priority over the return line's own `invoiceLineId`, so the exact source
 * line was discarded even when it was known.
 *
 * Same class of defect as the returns bug fixed earlier: identity by productId
 * on a document where productId is deliberately not unique.
 */

const db = prisma as unknown as {
  invoiceLine: { findMany: ReturnType<typeof vi.fn> };
  product: { findMany: ReturnType<typeof vi.fn> };
  unitOfMeasure: { findMany: ReturnType<typeof vi.fn> };
  invoice: { findFirst: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
  creditNote: { aggregate: ReturnType<typeof vi.fn> };
};

const PRODUCT = "prod-waffle";
const PAID_INVOICE_LINE = "il-paid";
const FREE_INVOICE_LINE = "il-free";

function makeContext() {
  return { organizationId: "org-1", userId: "user-1" };
}

/** Captures what `issue()` was asked to create. */
function buildService() {
  const issued: { input?: { lines: Array<{ invoiceLineId: string; totalPrice: number }> } } = {};

  const service = new CreditNoteService();
  vi.spyOn(service, "issue").mockImplementation(async (_ctx, input) => {
    issued.input = input as never;
    return { id: "cn-1" } as never;
  });

  return { service, issued };
}

function makeReturnOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "ro-1",
    returnNumber: "RET-1",
    customerId: "cust-1",
    invoiceId: "inv-1",
    invoice: { id: "inv-1", invoiceNumber: "INV-1", status: "ISSUED", totalAmount: 30 },
    salesOrderId: "so-1",
    lines: [
      {
        id: "rol-1",
        productId: PRODUCT,
        unitOfMeasureId: "uom-1",
        receivedQuantity: 5,
        unitPrice: 0.3,
        disposition: "RESTOCK",
        // The exact source line is known: the PAID one.
        invoiceLineId: PAID_INVOICE_LINE,
      },
    ],
    ...overrides,
  };
}

describe("credit note line matching with duplicate product lines", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // 100 NORMAL + 10 FREE_SAMPLE of one product, in line order.
    db.invoiceLine.findMany.mockResolvedValue([
      { id: PAID_INVOICE_LINE, productId: PRODUCT, lineNumber: 1, lineType: "NORMAL" },
      { id: FREE_INVOICE_LINE, productId: PRODUCT, lineNumber: 2, lineType: "FREE_SAMPLE" },
    ]);
    db.product.findMany.mockResolvedValue([
      { id: PRODUCT, name: "Waffle mixed berries", arabicName: null, sku: "WMB-001" },
    ]);
    db.unitOfMeasure.findMany.mockResolvedValue([{ id: "uom-1", code: "PC" }]);
  });

  it("credits the exact invoice line the return came from", async () => {
    const { service, issued } = buildService();

    await service.issueFromReturn(makeContext(), makeReturnOrder() as never);

    expect(issued.input!.lines[0].invoiceLineId).toBe(PAID_INVOICE_LINE);
  });

  it("never silently attributes the credit to the free-sample line", async () => {
    const { service, issued } = buildService();

    await service.issueFromReturn(makeContext(), makeReturnOrder() as never);

    expect(issued.input!.lines[0].invoiceLineId).not.toBe(FREE_INVOICE_LINE);
  });

  it("falls back to the first matching line in line order when the source is unknown", async () => {
    // No new paid-vs-free rule is introduced: the fallback simply uses the
    // existing line ordering, which is the same convention the returns fix uses.
    const { service, issued } = buildService();
    const returnOrder = makeReturnOrder({
      lines: [
        {
          id: "rol-1", productId: PRODUCT, unitOfMeasureId: "uom-1",
          receivedQuantity: 5, unitPrice: 0.3, disposition: "RESTOCK",
          invoiceLineId: null,
        },
      ],
    });

    await service.issueFromReturn(makeContext(), returnOrder as never);

    expect(issued.input!.lines[0].invoiceLineId).toBe(PAID_INVOICE_LINE);
  });

  it("derives the credit line total as quantity x unit price", async () => {
    const { service, issued } = buildService();

    await service.issueFromReturn(makeContext(), makeReturnOrder() as never);

    // 5 x 0.300 = 1.500
    expect(issued.input!.lines[0].totalPrice).toBeCloseTo(1.5, 3);
  });
});
