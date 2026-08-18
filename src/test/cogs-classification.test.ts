import { describe, expect, it } from "vitest";
import type { InventoryMovementType } from "@prisma/client";

import {
  CLASSIFICATION_LABELS,
  classifyLedgerEntry,
  cogsImpact,
  cogsLedgerWhere,
  writeOffLedgerWhere,
  type LedgerClassification,
} from "@/domains/reports/cogs-classification";

/**
 * One rule, three reports.
 *
 * The COGS report, the gross-profit detail report and the executive panel each
 * used to decide for themselves what counted as cost of goods sold, and they
 * disagreed. The executive aggregate took EVERY costed outbound ledger entry
 * with no movement-type filter at all, so an internal warehouse transfer, a
 * cycle-count shrinkage and a damaged pallet were all reported as cost of goods
 * sold. These tests pin the shared rule the three now share.
 */

/** Every value in the enum, so a new movement type cannot be silently ignored. */
const ALL_MOVEMENTS: InventoryMovementType[] = [
  "OPENING_BALANCE",
  "MANUAL_RECEIPT",
  "PURCHASE_RECEIPT",
  "SALE",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "CUSTOMER_RETURN",
  "SUPPLIER_RETURN",
  "DAMAGE",
  "EXPIRED",
  "LANDED_COST",
];

describe("COGS classification", () => {
  describe("cost of goods sold", () => {
    it("a SALE going OUT is COGS", () => {
      expect(classifyLedgerEntry("SALE", "OUT")).toBe("COGS");
    });

    it("a CUSTOMER_RETURN coming IN reverses COGS", () => {
      expect(classifyLedgerEntry("CUSTOMER_RETURN", "IN")).toBe("COGS_REVERSAL");
    });

    it("the reversal applies to scrapped returns too, not just restocked ones", () => {
      // Both dispositions post CUSTOMER_RETURN / IN. Whether the goods went
      // back on the shelf or into the bin, the original sale's cost has stopped
      // being the cost of a completed sale. A scrap then reappears as a
      // write-off, which is what separates "we sold it" from "we lost it".
      expect(classifyLedgerEntry("CUSTOMER_RETURN", "IN")).toBe("COGS_REVERSAL");
    });
  });

  describe("inventory write-offs", () => {
    it.each(["DAMAGE", "EXPIRED", "ADJUSTMENT_OUT"] as const)(
      "%s going OUT is a write-off, not COGS",
      (movement) => {
        expect(classifyLedgerEntry(movement, "OUT")).toBe("WRITE_OFF");
      },
    );

    it("write-offs never contribute to the COGS total", () => {
      for (const movement of ["DAMAGE", "EXPIRED", "ADJUSTMENT_OUT"] as const) {
        expect(cogsImpact(classifyLedgerEntry(movement, "OUT"), 100)).toBe(0);
      }
    });
  });

  describe("internal transfers", () => {
    it.each([
      ["TRANSFER_OUT", "OUT"],
      ["TRANSFER_IN", "IN"],
    ] as const)("%s is internal — neither COGS nor write-off", (movement, direction) => {
      expect(classifyLedgerEntry(movement, direction)).toBe("INTERNAL");
    });

    it("a transfer pair nets to zero in both buckets", () => {
      // Moving 100.000 of stock between warehouses must not register as a cost
      // in either direction. Before the fix TRANSFER_OUT counted as COGS while
      // TRANSFER_IN did not, so every transfer inflated cost of sales.
      const out = classifyLedgerEntry("TRANSFER_OUT", "OUT");
      const back = classifyLedgerEntry("TRANSFER_IN", "IN");
      expect(cogsImpact(out, 100) + cogsImpact(back, 100)).toBe(0);
      expect(out).not.toBe("WRITE_OFF");
      expect(back).not.toBe("WRITE_OFF");
    });
  });

  describe("everything else is excluded", () => {
    it.each([
      ["OPENING_BALANCE", "IN"],
      ["MANUAL_RECEIPT", "IN"],
      ["PURCHASE_RECEIPT", "IN"],
      ["ADJUSTMENT_IN", "IN"],
      ["SUPPLIER_RETURN", "OUT"],
      ["LANDED_COST", "IN"],
    ] as const)("%s is excluded", (movement, direction) => {
      expect(classifyLedgerEntry(movement, direction)).toBe("EXCLUDED");
    });

    it("direction matters: a SALE coming IN is not COGS", () => {
      expect(classifyLedgerEntry("SALE", "IN")).toBe("EXCLUDED");
    });

    it("direction matters: a CUSTOMER_RETURN going OUT is not a reversal", () => {
      expect(classifyLedgerEntry("CUSTOMER_RETURN", "OUT")).toBe("EXCLUDED");
    });
  });

  describe("completeness", () => {
    it("every movement type in the enum classifies to something", () => {
      for (const movement of ALL_MOVEMENTS) {
        for (const direction of ["IN", "OUT"] as const) {
          const result = classifyLedgerEntry(movement, direction);
          expect(
            ["COGS", "COGS_REVERSAL", "WRITE_OFF", "INTERNAL", "EXCLUDED"],
            `${movement}/${direction}`,
          ).toContain(result);
        }
      }
    });

    it("no movement type is both COGS and a write-off", () => {
      // Classification returns one bucket, so this holds by construction —
      // asserted anyway so that widening the return type later cannot quietly
      // let a movement count as both a sale and a loss.
      for (const movement of ALL_MOVEMENTS) {
        for (const direction of ["IN", "OUT"] as const) {
          const result: string = classifyLedgerEntry(movement, direction);
          const buckets = [
            result === "COGS" || result === "COGS_REVERSAL",
            result === "WRITE_OFF",
          ].filter(Boolean);
          expect(buckets.length, `${movement}/${direction}`).toBeLessThanOrEqual(1);
        }
      }
    });

    it("every classification has a label", () => {
      const all: LedgerClassification[] = [
        "COGS",
        "COGS_REVERSAL",
        "WRITE_OFF",
        "INTERNAL",
        "EXCLUDED",
      ];
      for (const c of all) {
        expect(CLASSIFICATION_LABELS[c]).toBeTruthy();
      }
    });
  });

  describe("cogsImpact signs", () => {
    it("a sale adds, a return subtracts, everything else is zero", () => {
      expect(cogsImpact("COGS", 90)).toBe(90);
      expect(cogsImpact("COGS_REVERSAL", 9)).toBe(-9);
      expect(cogsImpact("WRITE_OFF", 9)).toBe(0);
      expect(cogsImpact("INTERNAL", 9)).toBe(0);
      expect(cogsImpact("EXCLUDED", 9)).toBe(0);
    });

    it("100 sold then 10 returned nets to the cost of 90", () => {
      // The worked example: 100 units at 0.900 sold, 10 returned.
      expect(cogsImpact("COGS", 90) + cogsImpact("COGS_REVERSAL", 9)).toBeCloseTo(81, 3);
    });
  });

  describe("the query fragments match the classifier", () => {
    it("the COGS filter selects exactly the two COGS buckets", () => {
      expect(cogsLedgerWhere).toEqual({
        OR: [
          { direction: "OUT", movementType: { in: ["SALE"] } },
          { direction: "IN", movementType: { in: ["CUSTOMER_RETURN"] } },
        ],
      });
    });

    it("the write-off filter selects exactly the write-off bucket", () => {
      expect(writeOffLedgerWhere).toEqual({
        direction: "OUT",
        movementType: { in: ["DAMAGE", "EXPIRED", "ADJUSTMENT_OUT"] },
      });
    });

    it("the two filters are disjoint", () => {
      // Nothing may be counted as both a sale and a loss.
      const cogsPairs = new Set<string>();
      const writeOffPairs = new Set<string>();
      for (const movement of ALL_MOVEMENTS) {
        for (const direction of ["IN", "OUT"] as const) {
          const c = classifyLedgerEntry(movement, direction);
          if (c === "COGS" || c === "COGS_REVERSAL") cogsPairs.add(`${movement}/${direction}`);
          if (c === "WRITE_OFF") writeOffPairs.add(`${movement}/${direction}`);
        }
      }
      for (const pair of cogsPairs) expect(writeOffPairs.has(pair)).toBe(false);
      expect(cogsPairs.size).toBe(2);
      expect(writeOffPairs.size).toBe(3);
    });
  });
});
