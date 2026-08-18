import type { z } from "zod";

import { BusinessError } from "@/shared/errors/business-error";

import {
  assertClientTotalsMatch,
  calculateDocumentTotals,
  calculateHeaderOnlyTotals,
  type DocumentLineInput,
  type DocumentTotals,
} from "./document-totals";

/**
 * Attaches the canonical document calculation to a Zod schema.
 *
 * The schema is the one boundary every caller crosses — server actions, the
 * mobile API, scripts, future entry points. Enforcing here rather than in each
 * service means no path can bypass the rule and no new path can forget it.
 *
 * Two things happen at parse time:
 *
 *   1. Every derived money field is REPLACED with the server's own arithmetic.
 *   2. A caller whose figures disagree is REJECTED with a field-level
 *      validation error, rather than silently corrected — a client that showed
 *      a customer one total must never be able to persist a different one.
 *
 * See `document-totals.ts` for the arithmetic itself.
 */

/** Which line fields carry the quantity, the unit rate, and the line total. */
export type LineFieldNames = {
  quantity: string;
  unitRate: string;
  lineTotal: string;
};

/** Sales orders and quotations price by unitPrice; purchase orders by unitCost. */
export const SALES_LINE_FIELDS: LineFieldNames = {
  quantity: "orderedQuantity",
  unitRate: "unitPrice",
  lineTotal: "totalPrice",
};

export const QUOTATION_LINE_FIELDS: LineFieldNames = {
  quantity: "quantity",
  unitRate: "unitPrice",
  lineTotal: "totalPrice",
};

export const PURCHASE_LINE_FIELDS: LineFieldNames = {
  quantity: "orderedQuantity",
  unitRate: "unitCost",
  lineTotal: "totalCost",
};

type UnknownRecord = Record<string, unknown>;

function num(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

/**
 * Reports a BusinessError from the calculator as a Zod issue, so callers see a
 * normal field validation error instead of an exception. The message is the
 * calculator's own, which already names the offending figures.
 */
function reportIssue(ctx: z.RefinementCtx, error: unknown, path: string[]) {
  const message =
    error instanceof BusinessError
      ? error.message
      : "The document totals could not be calculated.";
  ctx.addIssue({ code: "custom", message, path });
}

/**
 * Replaces the derived header fields with the server's values.
 * `discountRate` is deliberately left alone: for a PERCENTAGE discount it is
 * the operator's input, and for FIXED it is normalised alongside the amount.
 */
function applyHeader<T extends UnknownRecord>(value: T, totals: DocumentTotals): T {
  const next: UnknownRecord = { ...value };
  next.subtotal = totals.subtotal.toNumber();
  next.taxAmount = totals.taxAmount.toNumber();
  next.totalAmount = totals.totalAmount.toNumber();

  if ("discountAmount" in value) {
    next.discountAmount = totals.discountAmount.toNumber();
    if (value.discountType === "FIXED") {
      next.discountRate = totals.discountAmount.toNumber();
    }
  }

  return next as T;
}

/**
 * Enforces the calculation on a document that has lines.
 *
 * Use inside `.transform((value, ctx) => enforceLineDocumentTotals(value, ctx, FIELDS))`.
 */
export function enforceLineDocumentTotals<T extends UnknownRecord>(
  value: T,
  ctx: z.RefinementCtx,
  fields: LineFieldNames,
): T {
  const rawLines = Array.isArray(value.lines) ? (value.lines as UnknownRecord[]) : [];

  const lineInputs: DocumentLineInput[] = rawLines.map((line) => ({
    quantity: num(line[fields.quantity]),
    unitPrice: num(line[fields.unitRate]),
    // Purchase orders have no line types; `undefined` simply means NORMAL.
    lineType: (line.lineType as DocumentLineInput["lineType"]) ?? undefined,
  }));

  let totals: DocumentTotals;
  try {
    totals = calculateDocumentTotals({
      lines: lineInputs,
      taxAmount: num(value.taxAmount),
      discountType: (value.discountType as "PERCENTAGE" | "FIXED" | undefined) ?? null,
      discountRate: value.discountRate == null ? null : num(value.discountRate),
    });
  } catch (error) {
    reportIssue(ctx, error, ["discountAmount"]);
    return value;
  }

  try {
    assertClientTotalsMatch(totals, {
      subtotal: value.subtotal == null ? null : num(value.subtotal),
      taxAmount: value.taxAmount == null ? null : num(value.taxAmount),
      discountAmount: value.discountAmount == null ? null : num(value.discountAmount),
      totalAmount: value.totalAmount == null ? null : num(value.totalAmount),
    });
  } catch (error) {
    reportIssue(ctx, error, ["totalAmount"]);
    return value;
  }

  // Lines keep their order and identity — never grouped, never merged. A
  // product may legitimately appear twice (a paid line and a free sample).
  const lines = rawLines.map((line, index) => ({
    ...line,
    [fields.unitRate]: totals.lines[index].unitPrice.toNumber(),
    [fields.lineTotal]: totals.lines[index].totalPrice.toNumber(),
  }));

  return applyHeader({ ...value, lines } as T, totals);
}

/**
 * Enforces the calculation on a document with no lines (supplier invoices),
 * where the subtotal is an operator input and only the total is derived.
 */
export function enforceHeaderDocumentTotals<T extends UnknownRecord>(
  value: T,
  ctx: z.RefinementCtx,
): T {
  let totals: DocumentTotals;
  try {
    totals = calculateHeaderOnlyTotals({
      subtotal: num(value.subtotal),
      taxAmount: num(value.taxAmount),
    });
  } catch (error) {
    reportIssue(ctx, error, ["subtotal"]);
    return value;
  }

  try {
    assertClientTotalsMatch(totals, {
      totalAmount: value.totalAmount == null ? null : num(value.totalAmount),
    });
  } catch (error) {
    reportIssue(ctx, error, ["totalAmount"]);
    return value;
  }

  return applyHeader(value, totals);
}
