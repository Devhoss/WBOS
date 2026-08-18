import { describe, expect, it } from "vitest";

import {
  assertClientTotalsMatch,
  calculateDocumentTotals,
  calculateHeaderOnlyTotals,
  MONEY_SCALE,
  previewDocumentTotals,
  roundMoney,
} from "@/shared/money/document-totals";
import { BusinessError } from "@/shared/errors/business-error";

/**
 * H4 — the canonical server-authoritative document calculation.
 *
 * The client supplies INPUTS (quantities, unit prices, the tax amount, the
 * discount type and rate). The server DERIVES every money figure: line totals,
 * subtotal, discount, and the final total. Client-supplied derived values are
 * never authoritative; when they disagree with the server's arithmetic the
 * request is rejected rather than silently trusted or overwritten.
 *
 * Rounding: KWD amounts are authoritative to 3 decimal places, ROUND_HALF_UP —
 * the mode already used by AllocationService. The final total is computed from
 * the ROUNDED components, never from hidden higher-precision intermediates.
 * This is the rule that decides the real production discrepancy:
 * SO-2026-000002 has subtotal 76.750 with a 5% discount, and 76.750 x 5% is
 * exactly 3.8375 — half a fils. Rounding first gives discount 3.838 and total
 * 72.912, and the document foots.
 */

function line(quantity: number, unitPrice: number, lineType?: "NORMAL" | "FREE_SAMPLE") {
  return { quantity, unitPrice, lineType };
}

describe("roundMoney", () => {
  it("rounds to 3 decimal places", () => {
    expect(MONEY_SCALE).toBe(3);
    expect(roundMoney(1.2344).toFixed(3)).toBe("1.234");
  });

  it("rounds half away from zero (ROUND_HALF_UP), matching AllocationService", () => {
    // The exact case that produced the production discrepancy.
    expect(roundMoney(3.8375).toFixed(3)).toBe("3.838");
    expect(roundMoney(0.0005).toFixed(3)).toBe("0.001");
    expect(roundMoney(2.3455).toFixed(3)).toBe("2.346");
  });

  it("accepts strings and Decimals without losing precision", () => {
    expect(roundMoney("3.8375").toFixed(3)).toBe("3.838");
  });
});

describe("line totals", () => {
  it("derives a line total as quantity x unitPrice", () => {
    const result = calculateDocumentTotals({ lines: [line(100, 0.3)] });

    expect(result.lines[0].totalPrice.toFixed(3)).toBe("30.000");
    expect(result.subtotal.toFixed(3)).toBe("30.000");
  });

  it("sums multiple lines into the subtotal", () => {
    const result = calculateDocumentTotals({
      lines: [line(100, 0.3), line(5, 1.25), line(2, 10)],
    });

    // 30.000 + 6.250 + 20.000
    expect(result.subtotal.toFixed(3)).toBe("56.250");
  });

  it("rounds each line before summing, so the subtotal always equals the printed lines", () => {
    // 3 x 0.3335 = 1.0005 exactly. Each line rounds to 0.334, so the subtotal
    // is 1.002 — what a customer adding up the printed document gets. Summing
    // unrounded values first would give 1.001 and the document would not foot.
    const result = calculateDocumentTotals({
      lines: [line(1, 0.3335), line(1, 0.3335), line(1, 0.3335)],
    });

    expect(result.lines.map((l) => l.totalPrice.toFixed(3))).toEqual(["0.334", "0.334", "0.334"]);
    expect(result.subtotal.toFixed(3)).toBe("1.002");
  });

  it("supports partial (fractional) quantities", () => {
    const result = calculateDocumentTotals({ lines: [line(2.5, 1.2)] });

    expect(result.lines[0].totalPrice.toFixed(3)).toBe("3.000");
  });

  it("rounds a partial-quantity line half up", () => {
    // 1.5 x 0.235 = 0.3525 -> 0.353
    const result = calculateDocumentTotals({ lines: [line(1.5, 0.235)] });

    expect(result.lines[0].totalPrice.toFixed(3)).toBe("0.353");
  });
});

describe("free samples", () => {
  it("forces a FREE_SAMPLE line to zero even when a price is supplied", () => {
    const result = calculateDocumentTotals({ lines: [line(10, 0.3, "FREE_SAMPLE")] });

    expect(result.lines[0].unitPrice.toFixed(3)).toBe("0.000");
    expect(result.lines[0].totalPrice.toFixed(3)).toBe("0.000");
    expect(result.subtotal.toFixed(3)).toBe("0.000");
  });

  it("keeps 100 NORMAL + 10 FREE_SAMPLE of one product as two independent lines", () => {
    // The real WBOS pattern, from SO-2026-000012. Lines must never be merged by
    // productId: the paid line keeps its price, the free line is zeroed, and
    // only the paid line reaches the subtotal.
    const result = calculateDocumentTotals({
      lines: [line(100, 0.3, "NORMAL"), line(10, 0.3, "FREE_SAMPLE")],
    });

    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].totalPrice.toFixed(3)).toBe("30.000");
    expect(result.lines[1].totalPrice.toFixed(3)).toBe("0.000");
    expect(result.subtotal.toFixed(3)).toBe("30.000");
    expect(result.totalAmount.toFixed(3)).toBe("30.000");
  });

  it("does not let a free sample dilute a percentage discount", () => {
    // The discount applies to the subtotal, which excludes the zero-priced line.
    const result = calculateDocumentTotals({
      lines: [line(100, 0.3, "NORMAL"), line(10, 0.3, "FREE_SAMPLE")],
      discountType: "PERCENTAGE",
      discountRate: 10,
    });

    expect(result.discountAmount.toFixed(3)).toBe("3.000");
    expect(result.totalAmount.toFixed(3)).toBe("27.000");
  });
});

describe("discounts", () => {
  it("THE PRODUCTION CASE: subtotal 76.750 at 5% gives discount 3.838 and total 72.912", () => {
    // 76.750 x 5% = 3.8375 exactly. The discount is rounded FIRST, then the
    // total is derived from the rounded components. Computing the total from
    // the unrounded 3.8375 is what produced the 1-fils drift on SO-2026-000002
    // and SO-2026-000013 in production.
    const result = calculateDocumentTotals({
      lines: [line(1, 76.75)],
      discountType: "PERCENTAGE",
      discountRate: 5,
    });

    expect(result.subtotal.toFixed(3)).toBe("76.750");
    expect(result.discountAmount.toFixed(3)).toBe("3.838");
    expect(result.totalAmount.toFixed(3)).toBe("72.912");

    // And the document foots: subtotal + tax - discount == total, exactly.
    const footed = result.subtotal.plus(result.taxAmount).minus(result.discountAmount);
    expect(footed.toFixed(3)).toBe(result.totalAmount.toFixed(3));
  });

  it("the second production case: subtotal 39.950 at 5% gives 1.998 and 37.952", () => {
    const result = calculateDocumentTotals({
      lines: [line(1, 39.95)],
      discountType: "PERCENTAGE",
      discountRate: 5,
    });

    expect(result.discountAmount.toFixed(3)).toBe("1.998");
    expect(result.totalAmount.toFixed(3)).toBe("37.952");
  });

  it("treats a FIXED discount rate as the discount amount itself", () => {
    const result = calculateDocumentTotals({
      lines: [line(1, 100)],
      discountType: "FIXED",
      discountRate: 12.5,
    });

    expect(result.discountAmount.toFixed(3)).toBe("12.500");
    expect(result.totalAmount.toFixed(3)).toBe("87.500");
  });

  it("applies no discount when none is specified", () => {
    const result = calculateDocumentTotals({ lines: [line(1, 100)] });

    expect(result.discountAmount.toFixed(3)).toBe("0.000");
    expect(result.totalAmount.toFixed(3)).toBe("100.000");
  });

  it("allows a discount exactly equal to the subtotal", () => {
    const result = calculateDocumentTotals({
      lines: [line(1, 50)],
      discountType: "FIXED",
      discountRate: 50,
    });

    expect(result.totalAmount.toFixed(3)).toBe("0.000");
  });

  it("rejects a FIXED discount greater than the subtotal", () => {
    expect(() =>
      calculateDocumentTotals({
        lines: [line(1, 50)],
        discountType: "FIXED",
        discountRate: 50.001,
      }),
    ).toThrowError(
      expect.objectContaining({ code: "DOCUMENT_DISCOUNT_EXCEEDS_SUBTOTAL" }),
    );
  });

  it("rejects a PERCENTAGE discount greater than 100%", () => {
    expect(() =>
      calculateDocumentTotals({
        lines: [line(1, 50)],
        discountType: "PERCENTAGE",
        discountRate: 101,
      }),
    ).toThrowError(
      expect.objectContaining({ code: "DOCUMENT_DISCOUNT_EXCEEDS_SUBTOTAL" }),
    );
  });

  it("rejects a negative discount rate", () => {
    expect(() =>
      calculateDocumentTotals({
        lines: [line(1, 50)],
        discountType: "FIXED",
        discountRate: -1,
      }),
    ).toThrowError(BusinessError);
  });
});

describe("tax", () => {
  it("treats the tax amount as an input and adds it to the total", () => {
    // No tax RATE exists anywhere in WBOS; tax is an absolute amount an
    // operator may type. Every existing document has zero tax. The structure
    // stays in place so a future tax rule has an obvious home.
    const result = calculateDocumentTotals({ lines: [line(1, 100)], taxAmount: 5 });

    expect(result.taxAmount.toFixed(3)).toBe("5.000");
    expect(result.totalAmount.toFixed(3)).toBe("105.000");
  });

  it("defaults tax to zero, preserving today's behaviour", () => {
    const result = calculateDocumentTotals({ lines: [line(1, 100)] });

    expect(result.taxAmount.toFixed(3)).toBe("0.000");
  });

  it("applies the discount to the subtotal, not to subtotal plus tax", () => {
    // 100 subtotal, 10 tax, 10% discount => discount is 10.000, not 11.000.
    const result = calculateDocumentTotals({
      lines: [line(1, 100)],
      taxAmount: 10,
      discountType: "PERCENTAGE",
      discountRate: 10,
    });

    expect(result.discountAmount.toFixed(3)).toBe("10.000");
    expect(result.totalAmount.toFixed(3)).toBe("100.000");
  });

  it("rejects a negative tax amount", () => {
    expect(() => calculateDocumentTotals({ lines: [line(1, 100)], taxAmount: -1 })).toThrowError(
      BusinessError,
    );
  });
});

describe("guards", () => {
  it("never produces a negative total", () => {
    // Tax cannot rescue an over-large discount: the discount guard fires first.
    expect(() =>
      calculateDocumentTotals({
        lines: [line(1, 10)],
        taxAmount: 100,
        discountType: "FIXED",
        discountRate: 50,
      }),
    ).toThrowError(
      expect.objectContaining({ code: "DOCUMENT_DISCOUNT_EXCEEDS_SUBTOTAL" }),
    );
  });

  it("rejects a negative quantity", () => {
    expect(() => calculateDocumentTotals({ lines: [line(-1, 10)] })).toThrowError(BusinessError);
  });

  it("rejects a negative unit price", () => {
    expect(() => calculateDocumentTotals({ lines: [line(1, -10)] })).toThrowError(BusinessError);
  });

  it("rejects a document with no lines", () => {
    expect(() => calculateDocumentTotals({ lines: [] })).toThrowError(BusinessError);
  });
});

describe("assertClientTotalsMatch", () => {
  const derived = calculateDocumentTotals({
    lines: [line(1, 76.75)],
    discountType: "PERCENTAGE",
    discountRate: 5,
  });

  it("accepts client values that agree with the server", () => {
    expect(() =>
      assertClientTotalsMatch(derived, {
        subtotal: 76.75,
        taxAmount: 0,
        discountAmount: 3.838,
        totalAmount: 72.912,
      }),
    ).not.toThrow();
  });

  it("accepts a client that omits derived values entirely", () => {
    // A caller that sends only inputs is the ideal case; there is nothing to
    // disagree about.
    expect(() => assertClientTotalsMatch(derived, {})).not.toThrow();
  });

  it("rejects the OLD client arithmetic that produced the production drift", () => {
    // The forms used to compute the total from the unrounded discount, sending
    // 72.913. That must now be refused, not silently corrected.
    expect(() =>
      assertClientTotalsMatch(derived, {
        subtotal: 76.75,
        taxAmount: 0,
        discountAmount: 3.838,
        totalAmount: 72.913,
      }),
    ).toThrowError(expect.objectContaining({ code: "DOCUMENT_TOTALS_MISMATCH" }));
  });

  it("rejects a tampered total", () => {
    expect(() =>
      assertClientTotalsMatch(derived, { totalAmount: 1 }),
    ).toThrowError(expect.objectContaining({ code: "DOCUMENT_TOTALS_MISMATCH" }));
  });

  it("rejects a tampered subtotal", () => {
    expect(() => assertClientTotalsMatch(derived, { subtotal: 1000 })).toThrowError(
      expect.objectContaining({ code: "DOCUMENT_TOTALS_MISMATCH" }),
    );
  });

  it("rejects a tampered discount", () => {
    expect(() => assertClientTotalsMatch(derived, { discountAmount: 0 })).toThrowError(
      expect.objectContaining({ code: "DOCUMENT_TOTALS_MISMATCH" }),
    );
  });

  it("names the field that disagreed so the error is actionable", () => {
    let message = "";
    try {
      assertClientTotalsMatch(derived, { totalAmount: 72.913 });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain("totalAmount");
    expect(message).toContain("72.912");
  });

  it("tolerates only sub-fils floating point noise", () => {
    // 0.0001 is representation noise from JSON round-tripping and is fine.
    expect(() => assertClientTotalsMatch(derived, { totalAmount: 72.9120001 })).not.toThrow();
    // A whole fils is a real disagreement.
    expect(() => assertClientTotalsMatch(derived, { totalAmount: 72.911 })).toThrowError(
      BusinessError,
    );
  });
});

describe("calculateHeaderOnlyTotals", () => {
  it("derives the total from an operator-entered subtotal and tax", () => {
    // Supplier invoices have no lines in WBOS: the operator types the subtotal
    // straight off the supplier's paper invoice, so the subtotal is an INPUT.
    // Only the total is derived.
    const result = calculateHeaderOnlyTotals({ subtotal: 100, taxAmount: 5 });

    expect(result.subtotal.toFixed(3)).toBe("100.000");
    expect(result.taxAmount.toFixed(3)).toBe("5.000");
    expect(result.discountAmount.toFixed(3)).toBe("0.000");
    expect(result.totalAmount.toFixed(3)).toBe("105.000");
  });

  it("rounds the subtotal and tax before adding them", () => {
    const result = calculateHeaderOnlyTotals({ subtotal: 1.0005, taxAmount: 0 });

    expect(result.subtotal.toFixed(3)).toBe("1.001");
    expect(result.totalAmount.toFixed(3)).toBe("1.001");
  });

  it("rejects a negative subtotal", () => {
    expect(() => calculateHeaderOnlyTotals({ subtotal: -1 })).toThrowError(BusinessError);
  });

  it("is checkable against client-supplied totals like any other document", () => {
    const derived = calculateHeaderOnlyTotals({ subtotal: 100, taxAmount: 5 });

    expect(() => assertClientTotalsMatch(derived, { totalAmount: 105 })).not.toThrow();
    expect(() => assertClientTotalsMatch(derived, { totalAmount: 999 })).toThrowError(
      expect.objectContaining({ code: "DOCUMENT_TOTALS_MISMATCH" }),
    );
  });
});

describe("previewDocumentTotals (client-side display)", () => {
  it("returns the same figures the server will derive", () => {
    // The forms must show the customer exactly what will be stored, or the
    // server rejects the submission. One implementation, both sides.
    const preview = previewDocumentTotals({
      lines: [line(1, 76.75)],
      discountType: "PERCENTAGE",
      discountRate: 5,
    });

    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.totals.discountAmount.toFixed(3)).toBe("3.838");
    expect(preview.totals.totalAmount.toFixed(3)).toBe("72.912");
  });

  it("reports a guard violation as a message instead of throwing", () => {
    // A form must not crash while the operator is mid-typing.
    const preview = previewDocumentTotals({
      lines: [line(1, 10)],
      discountType: "FIXED",
      discountRate: 999,
    });

    expect(preview.ok).toBe(false);
    if (preview.ok) return;
    expect(preview.message.toLowerCase()).toContain("discount");
  });

  it("reports an empty document as a message, not an exception", () => {
    const preview = previewDocumentTotals({ lines: [] });

    expect(preview.ok).toBe(false);
  });
});
