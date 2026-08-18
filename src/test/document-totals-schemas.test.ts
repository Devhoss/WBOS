import { describe, expect, it } from "vitest";

import {
  createSalesOrderSchema,
  updateSalesOrderSchema,
} from "@/domains/sales/validation/sales-order-schema";
import {
  createQuotationSchema,
  updateQuotationSchema,
} from "@/domains/quotations/validation/quotation-schema";
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
} from "@/domains/purchasing/validation/purchase-order-schema";
import {
  createSupplierInvoiceSchema,
  updateSupplierInvoiceSchema,
} from "@/domains/supplier-invoices/validation/supplier-invoice-schema";

/**
 * H4 — the canonical calculation enforced at every document entry point.
 *
 * The schema is the one boundary that every caller crosses: server actions, the
 * mobile API, scripts. Enforcing here means no service can be bypassed and no
 * future entry point can forget.
 *
 * Two things happen at parse time. Derived money is REPLACED with the server's
 * own arithmetic, and a caller whose figures disagree is REJECTED with a
 * validation error rather than silently corrected — so a client showing a
 * customer one total can never persist a different one.
 *
 * These cover create AND update for each document type: an edit form is a
 * second write path to the same rows, and only enforcing on create would make
 * editing the way around the rule.
 */

const soLine = (overrides: Record<string, unknown> = {}) => ({
  productId: "prod-1",
  unitOfMeasureId: "uom-1",
  orderedQuantity: 1,
  unitPrice: 76.75,
  totalPrice: 76.75,
  productName: "Waffle mixed berries",
  productSku: "WMB-001",
  unitOfMeasureCode: "PC",
  ...overrides,
});

const salesOrder = (overrides: Record<string, unknown> = {}) => ({
  customerId: "cust-1",
  currency: "KWD",
  subtotal: 76.75,
  taxAmount: 0,
  totalAmount: 76.75,
  lines: [soLine()],
  ...overrides,
});

const quotation = (overrides: Record<string, unknown> = {}) => ({
  customerId: "cust-1",
  currency: "KWD",
  subtotal: 76.75,
  taxAmount: 0,
  totalAmount: 76.75,
  lines: [
    {
      productId: "prod-1",
      unitOfMeasureId: "uom-1",
      quantity: 1,
      unitPrice: 76.75,
      totalPrice: 76.75,
      productName: "Waffle mixed berries",
      productSku: "WMB-001",
      unitOfMeasureCode: "PC",
    },
  ],
  ...overrides,
});

const purchaseOrder = (overrides: Record<string, unknown> = {}) => ({
  supplierId: "sup-1",
  currency: "KWD",
  subtotal: 20,
  taxAmount: 0,
  totalAmount: 20,
  lines: [
    { productId: "prod-1", unitOfMeasureId: "uom-1", orderedQuantity: 10, unitCost: 2, totalCost: 20 },
  ],
  ...overrides,
});

const supplierInvoice = (overrides: Record<string, unknown> = {}) => ({
  supplierId: "sup-1",
  currency: "KWD",
  subtotal: 100,
  taxAmount: 0,
  totalAmount: 100,
  ...overrides,
});

/** The message a rejected document carries, for readable assertions. */
function parseError(schema: { safeParse: (v: unknown) => { success: boolean; error?: unknown } }, value: unknown) {
  const result = schema.safeParse(value);
  expect(result.success).toBe(false);
  return JSON.stringify(result.error);
}

describe("sales order — server-authoritative totals", () => {
  it("THE PRODUCTION CASE: 76.750 at 5% derives discount 3.838 and total 72.912", () => {
    const parsed = createSalesOrderSchema.parse(
      salesOrder({
        discountType: "PERCENTAGE",
        discountRate: 5,
        discountAmount: 3.838,
        totalAmount: 72.912,
      }),
    );

    expect(parsed.discountAmount).toBeCloseTo(3.838, 3);
    expect(parsed.totalAmount).toBeCloseTo(72.912, 3);

    // The document foots exactly: subtotal + tax - discount == total.
    expect(parsed.subtotal + parsed.taxAmount - parsed.discountAmount).toBeCloseTo(
      parsed.totalAmount,
      3,
    );
  });

  it("REJECTS the old client arithmetic that produced the production drift", () => {
    // The forms computed the total from the UNROUNDED 3.8375 and sent 72.913.
    // Per the agreed rule this is refused, not silently corrected, so a client
    // can never show a customer one total and persist another.
    const error = parseError(
      createSalesOrderSchema,
      salesOrder({
        discountType: "PERCENTAGE",
        discountRate: 5,
        discountAmount: 3.838,
        totalAmount: 72.913,
      }),
    );

    expect(error).toContain("72.912");
    expect(error).toContain("totalAmount");
  });

  it("derives line totals rather than trusting the client's", () => {
    const parsed = createSalesOrderSchema.parse(
      salesOrder({
        lines: [soLine({ orderedQuantity: 100, unitPrice: 0.3, totalPrice: 999 })],
        subtotal: 30,
        totalAmount: 30,
      }),
    );

    expect(parsed.lines[0].totalPrice).toBeCloseTo(30, 3);
    expect(parsed.subtotal).toBeCloseTo(30, 3);
  });

  it("rejects a tampered total instead of silently overwriting it", () => {
    const error = parseError(createSalesOrderSchema, salesOrder({ totalAmount: 1 }));

    expect(error).toContain("totalAmount");
  });

  it("rejects a tampered subtotal", () => {
    expect(createSalesOrderSchema.safeParse(salesOrder({ subtotal: 1 })).success).toBe(false);
  });

  it("rejects a discount larger than the subtotal", () => {
    const error = parseError(
      createSalesOrderSchema,
      salesOrder({ discountType: "FIXED", discountRate: 1000, discountAmount: 1000, totalAmount: 0 }),
    );

    expect(error.toLowerCase()).toContain("discount");
  });

  it("keeps 100 NORMAL + 10 FREE_SAMPLE as two lines and prices only the paid one", () => {
    const parsed = createSalesOrderSchema.parse(
      salesOrder({
        lines: [
          soLine({ orderedQuantity: 100, unitPrice: 0.3, totalPrice: 30, lineType: "NORMAL" }),
          soLine({ orderedQuantity: 10, unitPrice: 0.3, totalPrice: 3, lineType: "FREE_SAMPLE" }),
        ],
        subtotal: 30,
        totalAmount: 30,
      }),
    );

    expect(parsed.lines).toHaveLength(2);
    expect(parsed.lines[0].productId).toBe(parsed.lines[1].productId);
    expect(parsed.lines[0].totalPrice).toBeCloseTo(30, 3);
    expect(parsed.lines[1].unitPrice).toBe(0);
    expect(parsed.lines[1].totalPrice).toBe(0);
    expect(parsed.subtotal).toBeCloseTo(30, 3);
  });

  it("applies the same rules when editing an existing order", () => {
    const parsed = updateSalesOrderSchema.parse({
      id: "so-1",
      ...salesOrder({
        discountType: "PERCENTAGE",
        discountRate: 5,
        discountAmount: 3.838,
        totalAmount: 72.912,
      }),
    });

    expect(parsed.totalAmount).toBeCloseTo(72.912, 3);
  });

  it("rejects the old arithmetic on the edit path too", () => {
    expect(
      updateSalesOrderSchema.safeParse({
        id: "so-1",
        ...salesOrder({
          discountType: "PERCENTAGE",
          discountRate: 5,
          discountAmount: 3.838,
          totalAmount: 72.913,
        }),
      }).success,
    ).toBe(false);
  });

  it("rejects a tampered total on the edit path too", () => {
    expect(
      updateSalesOrderSchema.safeParse({ id: "so-1", ...salesOrder({ totalAmount: 1 }) }).success,
    ).toBe(false);
  });

  it("accepts a caller that sends inputs only", () => {
    // The ideal client: no derived values to disagree about. Zod still requires
    // the header fields, so they are sent as the correct derived figures.
    const parsed = createSalesOrderSchema.parse(
      salesOrder({ lines: [soLine({ orderedQuantity: 3, unitPrice: 1.5, totalPrice: 4.5 })], subtotal: 4.5, totalAmount: 4.5 }),
    );

    expect(parsed.totalAmount).toBeCloseTo(4.5, 3);
  });
});

describe("quotation — server-authoritative totals", () => {
  it("derives discount and total the same way as a sales order", () => {
    const parsed = createQuotationSchema.parse(
      quotation({ discountType: "PERCENTAGE", discountRate: 5, discountAmount: 3.838, totalAmount: 72.912 }),
    );

    expect(parsed.discountAmount).toBeCloseTo(3.838, 3);
    expect(parsed.totalAmount).toBeCloseTo(72.912, 3);
  });

  it("rejects the old quotation arithmetic", () => {
    expect(
      createQuotationSchema.safeParse(
        quotation({ discountType: "PERCENTAGE", discountRate: 5, discountAmount: 3.838, totalAmount: 72.913 }),
      ).success,
    ).toBe(false);
  });

  it("rejects a tampered total", () => {
    expect(createQuotationSchema.safeParse(quotation({ totalAmount: 1 })).success).toBe(false);
  });

  it("enforces the rules on the edit path", () => {
    expect(
      updateQuotationSchema.safeParse({ id: "qt-1", ...quotation({ totalAmount: 1 }) }).success,
    ).toBe(false);
  });
});

describe("purchase order — server-authoritative totals", () => {
  it("derives line cost totals and the subtotal", () => {
    const parsed = createPurchaseOrderSchema.parse(
      purchaseOrder({
        lines: [
          { productId: "p1", unitOfMeasureId: "u1", orderedQuantity: 10, unitCost: 2, totalCost: 999 },
        ],
      }),
    );

    expect(parsed.lines[0].totalCost).toBeCloseTo(20, 3);
    expect(parsed.subtotal).toBeCloseTo(20, 3);
  });

  it("adds tax to reach the total, with no discount concept", () => {
    const parsed = createPurchaseOrderSchema.parse(
      purchaseOrder({ taxAmount: 5, totalAmount: 25 }),
    );

    expect(parsed.totalAmount).toBeCloseTo(25, 3);
  });

  it("rejects a tampered total", () => {
    expect(createPurchaseOrderSchema.safeParse(purchaseOrder({ totalAmount: 1 })).success).toBe(
      false,
    );
  });

  it("enforces the rules on the edit path", () => {
    expect(
      updatePurchaseOrderSchema.safeParse({ id: "po-1", ...purchaseOrder({ totalAmount: 1 }) })
        .success,
    ).toBe(false);
  });
});

describe("supplier invoice — server-authoritative total", () => {
  it("derives the total from the operator-entered subtotal and tax", () => {
    // A supplier invoice has no lines: the subtotal is typed off the supplier's
    // paper invoice and is a genuine input. Only the total is derived.
    const parsed = createSupplierInvoiceSchema.parse(
      supplierInvoice({ subtotal: 100, taxAmount: 5, totalAmount: 105 }),
    );

    expect(parsed.totalAmount).toBeCloseTo(105, 3);
  });

  it("rejects a total that does not equal subtotal plus tax", () => {
    expect(
      createSupplierInvoiceSchema.safeParse(
        supplierInvoice({ subtotal: 100, taxAmount: 5, totalAmount: 100 }),
      ).success,
    ).toBe(false);
  });

  it("enforces the rules on the edit path", () => {
    expect(
      updateSupplierInvoiceSchema.safeParse({
        id: "si-1",
        ...supplierInvoice({ subtotal: 100, taxAmount: 5, totalAmount: 100 }),
      }).success,
    ).toBe(false);
  });
});
