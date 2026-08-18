import { Decimal } from "decimal.js";

import { BusinessError } from "@/shared/errors/business-error";

/**
 * The canonical WBOS document calculation — the single authority for the
 * arithmetic on sales orders, quotations, purchase orders, supplier invoices,
 * invoices and credit notes.
 *
 * WHY THIS EXISTS
 *
 * Every document used to arrive with its subtotal, discount and total already
 * computed by the browser, and the server stored those numbers as sent. The
 * client was therefore the authority for money. Two consequences: a caller that
 * was not the web form could persist any totals it liked, and a rounding
 * difference in the form silently became the stored value.
 *
 * The second one was not hypothetical. SO-2026-000002 carries subtotal 76.750
 * with a 5% discount. 76.750 x 5% is exactly 3.8375 — half a fils. The form
 * stored the discount rounded to 3.838 but computed the total from the
 * unrounded 3.8375, so the invoice reads 72.913 while subtotal minus discount
 * is 72.912. The document does not foot, by one fils, on a real customer
 * invoice.
 *
 * THE RULES
 *
 * Inputs, supplied by the caller: quantity, unit price, line type, the tax
 * amount, and the discount type and rate.
 * Derived, computed only here: line totals, subtotal, discount amount, and the
 * final total.
 *
 *   1. lineTotal   = round(quantity x unitPrice)   per line
 *      FREE_SAMPLE lines are zero-priced by definition, whatever price arrived.
 *   2. subtotal    = round(sum of the ROUNDED line totals)
 *   3. discount    = 0                       when no discount
 *                  = round(discountRate)     when FIXED
 *                  = round(subtotal x rate / 100) when PERCENTAGE
 *   4. tax         = round(taxAmount)        an input, passed through
 *   5. total       = round(subtotal + tax - discount)
 *
 * Step 5 uses the ROUNDED components from steps 2-4, never a higher-precision
 * intermediate. That is what makes the printed document foot.
 *
 * Amounts are authoritative to three decimal places (KWD fils) and round half
 * away from zero — the same ROUND_HALF_UP already used by AllocationService.
 *
 * TAX: there is no tax rate anywhere in WBOS. `taxAmount` is an absolute figure
 * an operator may type, and every existing document has zero tax. Nothing new
 * is introduced here; the term simply keeps its place in the formula so a
 * future tax rule has an obvious home.
 *
 * DUPLICATE PRODUCTS: lines are never grouped or merged. The same product
 * legitimately appears as a NORMAL paid line and a FREE_SAMPLE line on one
 * order (100 sold plus 10 free). Every line is computed and kept on its own.
 */

/** KWD is a 3-decimal currency: the fils is the smallest authoritative unit. */
export const MONEY_SCALE = 3;

/** Half a fils — the largest difference attributable to representation noise. */
const TOLERANCE = new Decimal("0.0005");

export type MoneyInput = Decimal.Value;

export type DocumentLineInput = {
  quantity: MoneyInput;
  unitPrice: MoneyInput;
  lineType?: "NORMAL" | "FREE_SAMPLE" | null;
};

export type DocumentTotalsInput = {
  lines: DocumentLineInput[];
  taxAmount?: MoneyInput | null;
  discountType?: "PERCENTAGE" | "FIXED" | null;
  discountRate?: MoneyInput | null;
};

export type DocumentLineTotals = {
  unitPrice: Decimal;
  totalPrice: Decimal;
};

export type DocumentTotals = {
  lines: DocumentLineTotals[];
  subtotal: Decimal;
  taxAmount: Decimal;
  discountAmount: Decimal;
  totalAmount: Decimal;
};

/** Values a caller may have computed itself, all optional. */
export type ClaimedTotals = {
  subtotal?: MoneyInput | null;
  taxAmount?: MoneyInput | null;
  discountAmount?: MoneyInput | null;
  totalAmount?: MoneyInput | null;
};

/** Rounds to the authoritative scale, half away from zero. */
export function roundMoney(value: MoneyInput): Decimal {
  return toDecimal(value, "amount").toDecimalPlaces(MONEY_SCALE, Decimal.ROUND_HALF_UP);
}

function toDecimal(value: MoneyInput, label: string): Decimal {
  let decimal: Decimal;
  try {
    decimal = new Decimal(value);
  } catch {
    throw new BusinessError(`The ${label} is not a valid number.`, "DOCUMENT_INVALID_NUMBER");
  }
  if (!decimal.isFinite()) {
    throw new BusinessError(`The ${label} is not a finite number.`, "DOCUMENT_INVALID_NUMBER");
  }
  return decimal;
}

function requireNonNegative(value: Decimal, label: string): Decimal {
  if (value.isNegative()) {
    throw new BusinessError(`The ${label} cannot be negative.`, "DOCUMENT_NEGATIVE_VALUE");
  }
  return value;
}

/**
 * Computes every derived money figure for a document.
 *
 * Throws a BusinessError rather than returning a partial result: a document
 * whose arithmetic is impossible must not be persisted at all.
 */
export function calculateDocumentTotals(input: DocumentTotalsInput): DocumentTotals {
  if (input.lines.length === 0) {
    throw new BusinessError(
      "A document must have at least one line.",
      "DOCUMENT_NO_LINES",
    );
  }

  const lines = input.lines.map((raw) => {
    const quantity = requireNonNegative(toDecimal(raw.quantity, "quantity"), "quantity");
    const suppliedPrice = requireNonNegative(
      toDecimal(raw.unitPrice, "unit price"),
      "unit price",
    );

    // A free sample is zero-priced by definition, regardless of what arrived.
    const unitPrice = raw.lineType === "FREE_SAMPLE" ? new Decimal(0) : suppliedPrice;

    return {
      unitPrice: roundMoney(unitPrice),
      totalPrice: roundMoney(quantity.times(unitPrice)),
    };
  });

  // Sum the ROUNDED line totals: the subtotal must equal what a reader gets
  // by adding up the printed lines.
  const subtotal = roundMoney(
    lines.reduce((sum, l) => sum.plus(l.totalPrice), new Decimal(0)),
  );

  const taxAmount = roundMoney(
    requireNonNegative(toDecimal(input.taxAmount ?? 0, "tax amount"), "tax amount"),
  );

  const discountAmount = calculateDiscount(subtotal, input);

  if (discountAmount.greaterThan(subtotal)) {
    throw new BusinessError(
      `The discount (${discountAmount.toFixed(MONEY_SCALE)}) cannot exceed the subtotal ` +
        `(${subtotal.toFixed(MONEY_SCALE)}).`,
      "DOCUMENT_DISCOUNT_EXCEEDS_SUBTOTAL",
    );
  }

  // Derived from the rounded components, never from a higher-precision value.
  const totalAmount = roundMoney(subtotal.plus(taxAmount).minus(discountAmount));

  if (totalAmount.isNegative()) {
    // Unreachable while the discount is capped at the subtotal and tax is
    // non-negative, but a total below zero must never be persisted.
    throw new BusinessError(
      "The document total cannot be negative.",
      "DOCUMENT_NEGATIVE_TOTAL",
    );
  }

  return { lines, subtotal, taxAmount, discountAmount, totalAmount };
}

function calculateDiscount(subtotal: Decimal, input: DocumentTotalsInput): Decimal {
  if (!input.discountType) return new Decimal(0);

  const rate = requireNonNegative(
    toDecimal(input.discountRate ?? 0, "discount rate"),
    "discount rate",
  );

  if (input.discountType === "FIXED") {
    return roundMoney(rate);
  }

  // PERCENTAGE — rounded here, BEFORE the total is derived from it.
  return roundMoney(subtotal.times(rate).div(100));
}

/**
 * Compares the caller's own arithmetic against the server's.
 *
 * The server's figures are the ones persisted either way; this exists so a
 * disagreement surfaces as a clear error instead of the caller silently
 * believing a total the document does not have. Omitted fields are not
 * checked — a caller that sends only inputs is the ideal case.
 */
export function assertClientTotalsMatch(
  derived: DocumentTotals,
  claimed: ClaimedTotals,
): void {
  const checks: Array<[keyof ClaimedTotals, Decimal]> = [
    ["subtotal", derived.subtotal],
    ["taxAmount", derived.taxAmount],
    ["discountAmount", derived.discountAmount],
    ["totalAmount", derived.totalAmount],
  ];

  for (const [field, expected] of checks) {
    const supplied = claimed[field];
    if (supplied === undefined || supplied === null) continue;

    const actual = toDecimal(supplied, field);
    if (actual.minus(expected).abs().greaterThan(TOLERANCE)) {
      throw new BusinessError(
        `The submitted ${field} (${actual.toFixed(MONEY_SCALE)}) does not match the ` +
          `calculated ${field} (${expected.toFixed(MONEY_SCALE)}). ` +
          `Please reload the document and try again.`,
        "DOCUMENT_TOTALS_MISMATCH",
      );
    }
  }
}

/**
 * Totals for a document that has no lines.
 *
 * Supplier invoices are the only such document in WBOS: an operator types the
 * subtotal straight off the supplier's paper invoice, so the subtotal is an
 * authoritative INPUT rather than something the server can derive. Only the
 * total is derived, and it is still derived here rather than by the caller.
 */
export function calculateHeaderOnlyTotals(input: {
  subtotal: MoneyInput;
  taxAmount?: MoneyInput | null;
}): DocumentTotals {
  const subtotal = roundMoney(
    requireNonNegative(toDecimal(input.subtotal, "subtotal"), "subtotal"),
  );
  const taxAmount = roundMoney(
    requireNonNegative(toDecimal(input.taxAmount ?? 0, "tax amount"), "tax amount"),
  );

  return {
    lines: [],
    subtotal,
    taxAmount,
    discountAmount: new Decimal(0),
    totalAmount: roundMoney(subtotal.plus(taxAmount)),
  };
}

export type TotalsPreview =
  | { ok: true; totals: DocumentTotals }
  | { ok: false; message: string };

/**
 * The non-throwing form, for the browser.
 *
 * Forms must display exactly the figures the server will derive — otherwise the
 * operator sees one total, submits, and the server rejects it. Sharing this one
 * implementation is what keeps the two sides in agreement, instead of two
 * copies of the arithmetic drifting apart (which is precisely how the 1-fils
 * discrepancy reached production).
 *
 * Returns a message rather than throwing, because a half-typed form is a normal
 * state and must not crash.
 */
export function previewDocumentTotals(input: DocumentTotalsInput): TotalsPreview {
  try {
    return { ok: true, totals: calculateDocumentTotals(input) };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof BusinessError
          ? error.message
          : "The document totals could not be calculated.",
    };
  }
}
