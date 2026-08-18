import type { InvoiceStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";

/**
 * The invoice's status as a function of its money.
 *
 * `CREDITED` is a statement about the invoice's CURRENT financial state, not a
 * record that a credit note once existed. Cancelling a credit note releases the
 * credit, so an invoice that is no longer fully credited must not stay stuck in
 * `CREDITED` — it goes back to whatever its payments say it is.
 *
 * No new accounting states are introduced here. The paid/partially-paid rule is
 * the one `PaymentService.record` has always applied, lifted out so the credit
 * note paths and the payment path cannot drift apart:
 *
 *     fullyPaid = amountPaid >= totalAmount ? PAID : PARTIALLY_PAID
 *
 * Precedence, highest first:
 *   1. DRAFT and CANCELLED are terminal for this purpose and pass through
 *      untouched — an invoice that was never issued, or was voided, does not
 *      acquire a payment state from its amounts.
 *   2. Fully credited wins over fully paid: a sale that has been entirely
 *      reversed reads as CREDITED even if the customer had already paid it.
 *   3. Otherwise the payment rule decides.
 *   4. An unpaid invoice that is already flagged OVERDUE stays OVERDUE rather
 *      than being quietly reset to ISSUED. Nothing currently writes OVERDUE,
 *      but discarding it here would silently lose the flag if anything ever
 *      does.
 */
export type InvoiceMoney = {
  totalAmount: Prisma.Decimal | number | string;
  amountPaid: Prisma.Decimal | number | string;
  creditedAmount: Prisma.Decimal | number | string;
};

const PASS_THROUGH: readonly InvoiceStatus[] = ["DRAFT", "CANCELLED"];

export function deriveInvoicePaymentStatus(
  money: InvoiceMoney,
  currentStatus: InvoiceStatus,
): InvoiceStatus {
  if (PASS_THROUGH.includes(currentStatus)) return currentStatus;

  const total = new Prisma.Decimal(money.totalAmount);
  const paid = new Prisma.Decimal(money.amountPaid);
  const credited = new Prisma.Decimal(money.creditedAmount);

  if (credited.greaterThanOrEqualTo(total)) return "CREDITED";
  if (paid.greaterThanOrEqualTo(total)) return "PAID";
  if (paid.greaterThan(0)) return "PARTIALLY_PAID";
  if (currentStatus === "OVERDUE") return "OVERDUE";

  return "ISSUED";
}
