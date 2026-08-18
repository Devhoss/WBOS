import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";

import { deriveInvoicePaymentStatus } from "@/domains/sales/services/invoice-payment-status";

/**
 * `CREDITED` describes what the invoice is worth NOW, not what once happened to
 * it. Cancelling a credit note used to leave the invoice stuck in `CREDITED`
 * even after the credit was released, so a live collectable invoice read as
 * written off — and, because the AR queries filter on
 * `status IN (ISSUED, PARTIALLY_PAID, OVERDUE)`, it also silently dropped out
 * of receivables.
 *
 * The payment rule here is not new. It is the one `PaymentService.record` has
 * always applied, lifted into one place so the credit-note paths and the
 * payment path cannot drift apart.
 */

const D = (v: number) => new Prisma.Decimal(v);

function money(total: number, paid: number, credited: number) {
  return { totalAmount: D(total), amountPaid: D(paid), creditedAmount: D(credited) };
}

describe("deriveInvoicePaymentStatus", () => {
  describe("releasing a credit returns the invoice to its payment state", () => {
    it("fully paid and no longer fully credited -> PAID", () => {
      expect(deriveInvoicePaymentStatus(money(100, 100, 0), "CREDITED")).toBe("PAID");
    });

    it("partially paid and no longer fully credited -> PARTIALLY_PAID", () => {
      expect(deriveInvoicePaymentStatus(money(100, 40, 0), "CREDITED")).toBe("PARTIALLY_PAID");
    });

    it("unpaid and no longer fully credited -> ISSUED", () => {
      expect(deriveInvoicePaymentStatus(money(100, 0, 0), "CREDITED")).toBe("ISSUED");
    });

    it("still partially credited but unpaid -> ISSUED, not CREDITED", () => {
      // A residual credit does not make the invoice written off.
      expect(deriveInvoicePaymentStatus(money(100, 0, 30), "CREDITED")).toBe("ISSUED");
    });
  });

  describe("applying a credit", () => {
    it("fully credited -> CREDITED", () => {
      expect(deriveInvoicePaymentStatus(money(100, 0, 100), "ISSUED")).toBe("CREDITED");
    });

    it("credited beyond the total is still just CREDITED", () => {
      // The DB CHECK constraint prevents this, but the derivation must not be
      // the thing that depends on it.
      expect(deriveInvoicePaymentStatus(money(100, 0, 150), "ISSUED")).toBe("CREDITED");
    });

    it("fully credited wins over fully paid", () => {
      // A sale entirely reversed reads as CREDITED even if it had been paid.
      expect(deriveInvoicePaymentStatus(money(100, 100, 100), "PAID")).toBe("CREDITED");
    });

    it("a partial credit leaves a paid invoice PAID", () => {
      expect(deriveInvoicePaymentStatus(money(100, 100, 20), "PAID")).toBe("PAID");
    });

    it("a partial credit leaves an unpaid invoice ISSUED", () => {
      expect(deriveInvoicePaymentStatus(money(100, 0, 20), "ISSUED")).toBe("ISSUED");
    });
  });

  describe("boundaries", () => {
    it("credited exactly equal to the total is CREDITED", () => {
      expect(deriveInvoicePaymentStatus(money(100, 0, 100), "ISSUED")).toBe("CREDITED");
    });

    it("one fils short of fully credited is not CREDITED", () => {
      expect(deriveInvoicePaymentStatus(money(100, 0, 99.999), "ISSUED")).toBe("ISSUED");
    });

    it("paid exactly equal to the total is PAID", () => {
      expect(deriveInvoicePaymentStatus(money(100, 100, 0), "PARTIALLY_PAID")).toBe("PAID");
    });

    it("one fils short of fully paid is PARTIALLY_PAID", () => {
      expect(deriveInvoicePaymentStatus(money(100, 99.999, 0), "ISSUED")).toBe("PARTIALLY_PAID");
    });

    it("a zero-value invoice is both fully paid and fully credited -> CREDITED", () => {
      expect(deriveInvoicePaymentStatus(money(0, 0, 0), "ISSUED")).toBe("CREDITED");
    });
  });

  describe("statuses that must not be recomputed", () => {
    it("a CANCELLED invoice stays CANCELLED whatever its amounts say", () => {
      expect(deriveInvoicePaymentStatus(money(100, 100, 0), "CANCELLED")).toBe("CANCELLED");
      expect(deriveInvoicePaymentStatus(money(100, 0, 100), "CANCELLED")).toBe("CANCELLED");
    });

    it("a DRAFT invoice stays DRAFT", () => {
      expect(deriveInvoicePaymentStatus(money(100, 0, 0), "DRAFT")).toBe("DRAFT");
    });
  });

  describe("OVERDUE", () => {
    it("an unpaid OVERDUE invoice is not quietly reset to ISSUED", () => {
      expect(deriveInvoicePaymentStatus(money(100, 0, 0), "OVERDUE")).toBe("OVERDUE");
    });

    it("but a payment still moves it on", () => {
      expect(deriveInvoicePaymentStatus(money(100, 40, 0), "OVERDUE")).toBe("PARTIALLY_PAID");
      expect(deriveInvoicePaymentStatus(money(100, 100, 0), "OVERDUE")).toBe("PAID");
    });
  });

  describe("agreement with the payment path", () => {
    it("matches PaymentService's rule for every uncredited invoice", () => {
      // PaymentService.record writes `amountPaid >= totalAmount ? PAID :
      // PARTIALLY_PAID` after every payment. Where there is no credit, this
      // function must give the same answer, or the two paths would fight.
      for (const [total, paid] of [
        [100, 0.001],
        [100, 50],
        [100, 99.999],
        [100, 100],
        [0.001, 0.001],
      ] as const) {
        const expected = paid >= total ? "PAID" : "PARTIALLY_PAID";
        expect(deriveInvoicePaymentStatus(money(total, paid, 0), "ISSUED")).toBe(expected);
      }
    });
  });

  describe("input shapes", () => {
    it("accepts numbers and strings as well as Decimals", () => {
      expect(
        deriveInvoicePaymentStatus(
          { totalAmount: "100.000", amountPaid: 100, creditedAmount: "0" },
          "CREDITED",
        ),
      ).toBe("PAID");
    });
  });
});
