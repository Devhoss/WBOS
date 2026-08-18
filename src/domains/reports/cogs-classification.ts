import type { InventoryDirection, InventoryMovementType, Prisma } from "@prisma/client";

/**
 * One canonical answer to "does this inventory movement belong in cost of
 * goods sold?" — shared by the COGS report, the gross-profit detail report and
 * the executive profitability panel.
 *
 * It exists because those three drifted. Two of them filtered invoices by
 * `status IN ('ISSUED','PAID')` with nothing holding them together, and the
 * executive COGS aggregate took EVERY costed outbound ledger entry regardless
 * of what the movement actually was — so an internal warehouse transfer, a
 * cycle-count shrinkage and a damaged pallet all reported as cost of goods
 * sold. Anything that needs this rule must import it from here rather than
 * writing its own WHERE clause.
 *
 * The classification:
 *
 *   COGS           SALE / OUT — goods left the building against a sale.
 *   COGS_REVERSAL  CUSTOMER_RETURN / IN — goods came back. Whether they were
 *                  restocked or scrapped, the original sale's cost is no longer
 *                  the cost of a completed sale, so it comes out of COGS. For a
 *                  scrap the same amount lands in WRITE_OFF instead, which is
 *                  what separates "we sold it" from "we lost it".
 *   WRITE_OFF      DAMAGE / EXPIRED / ADJUSTMENT_OUT, all OUT. Inventory losses.
 *                  Real cost to the business, but not cost of goods SOLD, so
 *                  they are reported on their own line and never inside gross
 *                  profit.
 *   INTERNAL       TRANSFER_OUT / TRANSFER_IN. Stock moving between warehouses
 *                  is not a P&L event in either direction; the pair nets to
 *                  zero and both sides are excluded.
 *   EXCLUDED       Everything else — receipts, opening balances, landed cost
 *                  revaluations. Inbound or valuation-only.
 */
export type LedgerClassification =
  | "COGS"
  | "COGS_REVERSAL"
  | "WRITE_OFF"
  | "INTERNAL"
  | "EXCLUDED";

/** Outbound movements that are cost of goods sold. */
export const COGS_OUT_MOVEMENTS = ["SALE"] as const satisfies readonly InventoryMovementType[];

/** Inbound movements that take cost back out of COGS. */
export const COGS_REVERSAL_IN_MOVEMENTS = [
  "CUSTOMER_RETURN",
] as const satisfies readonly InventoryMovementType[];

/** Outbound movements that are an inventory loss rather than a sale. */
export const WRITE_OFF_OUT_MOVEMENTS = [
  "DAMAGE",
  "EXPIRED",
  "ADJUSTMENT_OUT",
] as const satisfies readonly InventoryMovementType[];

/** Movements that relocate stock without any P&L effect. */
export const INTERNAL_MOVEMENTS = [
  "TRANSFER_OUT",
  "TRANSFER_IN",
] as const satisfies readonly InventoryMovementType[];

function includes(list: readonly InventoryMovementType[], value: InventoryMovementType) {
  return list.includes(value);
}

export function classifyLedgerEntry(
  movementType: InventoryMovementType,
  direction: InventoryDirection,
): LedgerClassification {
  if (includes(INTERNAL_MOVEMENTS, movementType)) return "INTERNAL";
  if (direction === "OUT" && includes(COGS_OUT_MOVEMENTS, movementType)) return "COGS";
  if (direction === "IN" && includes(COGS_REVERSAL_IN_MOVEMENTS, movementType)) return "COGS_REVERSAL";
  if (direction === "OUT" && includes(WRITE_OFF_OUT_MOVEMENTS, movementType)) return "WRITE_OFF";
  return "EXCLUDED";
}

/**
 * How a classified entry moves the COGS total.
 *
 * A reversal subtracts; everything outside the two COGS buckets contributes
 * nothing at all, so a caller cannot accidentally fold a write-off in by
 * summing the wrong field.
 */
export function cogsImpact(classification: LedgerClassification, totalCost: number): number {
  if (classification === "COGS") return totalCost;
  if (classification === "COGS_REVERSAL") return -totalCost;
  return 0;
}

/** Every ledger entry that participates in COGS, in either direction. */
export const cogsLedgerWhere: Prisma.InventoryLedgerEntryWhereInput = {
  OR: [
    { direction: "OUT", movementType: { in: [...COGS_OUT_MOVEMENTS] } },
    { direction: "IN", movementType: { in: [...COGS_REVERSAL_IN_MOVEMENTS] } },
  ],
};

/** Every ledger entry that is an inventory write-off. */
export const writeOffLedgerWhere: Prisma.InventoryLedgerEntryWhereInput = {
  direction: "OUT",
  movementType: { in: [...WRITE_OFF_OUT_MOVEMENTS] },
};

/** Human-facing label for the classification column on the COGS report. */
export const CLASSIFICATION_LABELS: Record<LedgerClassification, string> = {
  COGS: "Cost of Sales",
  COGS_REVERSAL: "Customer Return",
  WRITE_OFF: "Write-off",
  INTERNAL: "Internal Transfer",
  EXCLUDED: "Not Applicable",
};
