import type { InvoiceStatus } from "@prisma/client";

/**
 * Which invoices count as revenue.
 *
 * Gross profit is a statement about SALES, not about cash collection. An
 * invoice that has been issued represents a completed sale whose goods have
 * left the warehouse and whose cost has already been posted to the ledger.
 * Whether the customer has paid yet changes the receivable, not the sale.
 *
 * The reports previously filtered `status IN ('ISSUED', 'PAID')`, which silently
 * dropped two states an invoice reaches through entirely normal operation:
 *
 *   - PARTIALLY_PAID, the moment any part-payment is recorded;
 *   - OVERDUE, when the due date passes unpaid.
 *
 * So taking a deposit against an invoice made the whole sale — revenue AND its
 * margin — vanish from gross profit, while its COGS stayed in the ledger. The
 * report got worse the more customers paid.
 *
 * CREDITED is included deliberately. A fully credited invoice is still a sale
 * that happened; it is netted off by subtracting the credit notes, which is
 * more faithful than making the sale disappear. DRAFT (not yet a sale) and
 * CANCELLED (voided) are excluded.
 */
export const REVENUE_INVOICE_STATUSES: readonly InvoiceStatus[] = [
  "ISSUED",
  "PARTIALLY_PAID",
  "OVERDUE",
  "PAID",
  "CREDITED",
];

/**
 * Credit notes reduce recognised revenue, and only ISSUED ones do: a CANCELLED
 * credit note has already released its claim on the invoice.
 */
export const REVENUE_REDUCING_CREDIT_NOTE_STATUSES = ["ISSUED"] as const;
