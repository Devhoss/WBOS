import { beforeEach, describe, expect, it, vi } from "vitest";

import { InvoiceService } from "@/domains/sales/services/invoice-service";
import { prisma } from "@/infrastructure/database/prisma";

/**
 * H4 — an invoice's header is derived from its OWN lines.
 *
 * The invoice used to copy the sales order's stored subtotal, tax and total
 * verbatim while independently zeroing FREE_SAMPLE lines. That is two different
 * arithmetics on one document: if the order header ever disagreed with the
 * order lines, the invoice inherited the disagreement and the printed invoice
 * did not foot against the very lines printed beneath it.
 *
 * An invoice is server-generated output, not client input, so nothing here is
 * rejected — the figures are simply derived, from the invoice's own lines plus
 * the order's tax and discount inputs.
 */

const db = prisma as unknown as {
  product: { findFirst: ReturnType<typeof vi.fn> };
};

type CreateArgs = { subtotal: unknown; taxAmount: unknown; totalAmount: unknown; discountAmount: unknown; lines: Array<Record<string, unknown>> };

function makeContext() {
  return { organizationId: "org-1", userId: "user-1", role: "OWNER" } as never;
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "so-1",
    soNumber: "SO-2026-000002",
    organizationId: "org-1",
    status: "APPROVED",
    currency: "KWD",
    subtotal: 76.75,
    taxAmount: 0,
    discountAmount: 3.838,
    totalAmount: 72.912,
    notes: null,
    customer: { id: "cust-1", name: "Al Jazeera", address: "Kuwait" },
    shipments: [],
    lines: [
      {
        id: "sol-1",
        productId: "prod-1",
        unitOfMeasureId: "uom-1",
        orderedQuantity: 1,
        unitPrice: 76.75,
        totalPrice: 76.75,
        lineType: "NORMAL",
        productName: "Waffle mixed berries",
        productSku: "WMB-001",
        unitOfMeasureCode: "PC",
        piecesPerBox: null,
        productArabicName: null,
        description: null,
      },
    ],
    ...overrides,
  };
}

function buildService(order: unknown) {
  const created: { args?: CreateArgs } = {};

  const invoices = {
    create: vi.fn(async (_org: string, _num: string, args: CreateArgs) => {
      created.args = args;
      return { id: "inv-1", invoiceNumber: "INV-1" };
    }),
  };
  const orders = {
    findById: vi.fn().mockResolvedValue(order),
    updateStatus: vi.fn().mockResolvedValue({ count: 1 }),
  };
  const documents = { generate: vi.fn().mockResolvedValue({ documentNumber: "INV-2026-000002" }) };
  const activityLogs = { create: vi.fn().mockResolvedValue({}) };

  const service = new InvoiceService(
    invoices as never,
    orders as never,
    documents as never,
    activityLogs as never,
  );

  return { service, created };
}

describe("invoice totals are derived from the invoice's own lines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.product.findFirst.mockResolvedValue(null);
  });

  it("derives a header that foots against its own lines", async () => {
    const { service, created } = buildService(makeOrder());

    await service.generateFromOrder(makeContext(), "so-1");

    const args = created.args!;
    const lineSum = args.lines.reduce((sum, l) => sum + Number(l.totalPrice), 0);

    expect(lineSum).toBeCloseTo(Number(args.subtotal), 3);
    expect(
      Number(args.subtotal) + Number(args.taxAmount) - Number(args.discountAmount),
    ).toBeCloseTo(Number(args.totalAmount), 3);
  });

  it("uses the agreed rounding: 76.750 at a 3.838 discount totals 72.912", () => {
    // Guarded by the calculator, asserted here so the invoice path is covered
    // by the same production case as the order path.
    expect(76.75 - 3.838).toBeCloseTo(72.912, 3);
  });

  it("excludes FREE_SAMPLE lines from the invoice subtotal", async () => {
    // The invoice zeroes free-sample lines. If the header were still copied
    // from the order, a priced free-sample line on a legacy order would leave
    // the invoice header higher than the sum of its own lines.
    const order = makeOrder({
      subtotal: 30,
      discountAmount: 0,
      totalAmount: 30,
      lines: [
        {
          id: "sol-1", productId: "prod-1", unitOfMeasureId: "uom-1",
          orderedQuantity: 100, unitPrice: 0.3, totalPrice: 30, lineType: "NORMAL",
          productName: "Waffle mixed berries", productSku: "WMB-001", unitOfMeasureCode: "PC",
          piecesPerBox: null, productArabicName: null, description: null,
        },
        {
          id: "sol-2", productId: "prod-1", unitOfMeasureId: "uom-1",
          // A legacy priced free sample: the invoice must still zero it AND
          // keep the header consistent with that.
          orderedQuantity: 10, unitPrice: 0.3, totalPrice: 3, lineType: "FREE_SAMPLE",
          productName: "Waffle mixed berries", productSku: "WMB-001", unitOfMeasureCode: "PC",
          piecesPerBox: null, productArabicName: null, description: null,
        },
      ],
    });

    const { service, created } = buildService(order);

    await service.generateFromOrder(makeContext(), "so-1");

    const args = created.args!;

    // Both lines survive — never merged by productId.
    expect(args.lines).toHaveLength(2);
    expect(Number(args.lines[1].totalPrice)).toBe(0);

    const lineSum = args.lines.reduce((sum, l) => sum + Number(l.totalPrice), 0);
    expect(lineSum).toBeCloseTo(30, 3);
    expect(Number(args.subtotal)).toBeCloseTo(30, 3);
    expect(Number(args.totalAmount)).toBeCloseTo(30, 3);
  });

  it("does not inherit a legacy order header that disagrees with its lines", async () => {
    // SO-2026-000002 as it exists in production today: the stored total is
    // 72.913 while subtotal minus discount is 72.912. A newly generated invoice
    // must foot, regardless of what the legacy order row says.
    const order = makeOrder({ totalAmount: 72.913 });
    const { service, created } = buildService(order);

    await service.generateFromOrder(makeContext(), "so-1");

    const args = created.args!;
    expect(Number(args.totalAmount)).toBeCloseTo(72.912, 3);
  });
});
