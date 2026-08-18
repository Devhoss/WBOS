import { describe, expect, it } from "vitest";

import {
  createSalesOrderSchema,
  updateSalesOrderSchema,
} from "@/domains/sales/validation/sales-order-schema";

/**
 * REGRESSION — audit finding M7.
 *
 * A FREE_SAMPLE line is zero-priced by definition. That rule was enforced only
 * by the web order form (which blanks the price inputs when the checkbox is
 * ticked) and again when the invoice was generated. The server accepted
 * whatever price the caller sent, so a non-browser client could persist a
 * priced free-sample line — priced on the sales order, silently zeroed on the
 * invoice, leaving the invoice header inconsistent with its own lines.
 *
 * The duplicate-product shape below is the real WBOS business model, taken
 * from SO-2026-000012: the same product legitimately appears twice, once as
 * 100 paid units and once as 10 free samples. Lines must NEVER be merged by
 * productId — the paid line keeps its price, the free line is zeroed, and both
 * survive independently.
 */

const PRODUCT = "prod-waffle-mixed-berries";

function baseLine(overrides: Record<string, unknown> = {}) {
  return {
    productId: PRODUCT,
    unitOfMeasureId: "uom-pc",
    orderedQuantity: 1,
    unitPrice: 0.3,
    totalPrice: 0.3,
    productName: "Waffle mixed berries",
    productSku: "WMB-001",
    unitOfMeasureCode: "PC",
    ...overrides,
  };
}

/**
 * Builds a header consistent with its own lines, the way a correct client does.
 * The server now rejects a document whose header disagrees with its lines, so a
 * fixture with hardcoded totals would fail for the wrong reason and hide what
 * these tests are actually about.
 */
function order(lines: unknown[]) {
  const subtotal = (lines as Array<Record<string, number | string>>).reduce((sum, line) => {
    if (line.lineType === "FREE_SAMPLE") return sum;
    return sum + Number(line.orderedQuantity) * Number(line.unitPrice);
  }, 0);

  return {
    customerId: "cust-1",
    currency: "KWD",
    subtotal,
    taxAmount: 0,
    totalAmount: subtotal,
    lines,
  };
}

describe("free-sample pricing is enforced server-side", () => {
  it("zeroes a FREE_SAMPLE line the client tried to price", () => {
    const parsed = createSalesOrderSchema.parse(
      order([
        baseLine({
          lineType: "FREE_SAMPLE",
          orderedQuantity: 10,
          unitPrice: 0.3,
          totalPrice: 3,
        }),
      ]),
    );

    expect(parsed.lines[0].unitPrice).toBe(0);
    expect(parsed.lines[0].totalPrice).toBe(0);
    expect(parsed.lines[0].lineType).toBe("FREE_SAMPLE");
  });

  it("keeps 100 NORMAL + 10 FREE_SAMPLE of the same product as two independent lines", () => {
    const parsed = createSalesOrderSchema.parse(
      order([
        baseLine({ lineType: "NORMAL", orderedQuantity: 100, unitPrice: 0.3, totalPrice: 30 }),
        // A hostile or buggy client sends the free line at full price.
        baseLine({ lineType: "FREE_SAMPLE", orderedQuantity: 10, unitPrice: 0.3, totalPrice: 3 }),
      ]),
    );

    // Never merged by productId — this is a legitimate business shape.
    expect(parsed.lines).toHaveLength(2);
    expect(parsed.lines[0].productId).toBe(parsed.lines[1].productId);

    // The paid line is untouched.
    expect(parsed.lines[0].lineType).toBe("NORMAL");
    expect(parsed.lines[0].orderedQuantity).toBe(100);
    expect(parsed.lines[0].unitPrice).toBe(0.3);
    expect(parsed.lines[0].totalPrice).toBe(30);

    // The free line is zeroed even though the same product is sold on line 1.
    expect(parsed.lines[1].lineType).toBe("FREE_SAMPLE");
    expect(parsed.lines[1].orderedQuantity).toBe(10);
    expect(parsed.lines[1].unitPrice).toBe(0);
    expect(parsed.lines[1].totalPrice).toBe(0);
  });

  it("does not alter NORMAL lines", () => {
    const parsed = createSalesOrderSchema.parse(
      order([baseLine({ lineType: "NORMAL", orderedQuantity: 100, unitPrice: 0.3, totalPrice: 30 })]),
    );

    expect(parsed.lines[0].unitPrice).toBe(0.3);
    expect(parsed.lines[0].totalPrice).toBe(30);
  });

  it("treats an omitted lineType as NORMAL and leaves its price alone", () => {
    const parsed = createSalesOrderSchema.parse(order([baseLine()]));

    expect(parsed.lines[0].lineType).toBe("NORMAL");
    expect(parsed.lines[0].unitPrice).toBe(0.3);
  });

  it("applies the same rule on update, not only on create", () => {
    // Editing a draft order is a second write path to the same rows. Both must
    // enforce the rule, or the edit form becomes the way around it.
    const parsed = updateSalesOrderSchema.parse({
      id: "so-1",
      ...order([
        baseLine({ lineType: "NORMAL", orderedQuantity: 100, unitPrice: 0.3, totalPrice: 30 }),
        baseLine({ lineType: "FREE_SAMPLE", orderedQuantity: 10, unitPrice: 0.3, totalPrice: 3 }),
      ]),
    });

    expect(parsed.lines).toHaveLength(2);
    expect(parsed.lines[1].unitPrice).toBe(0);
    expect(parsed.lines[1].totalPrice).toBe(0);
  });
});
