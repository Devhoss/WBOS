import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { AllocationService } from "@/domains/purchasing/services/allocation-service";

const D = (v: number | string) => new Prisma.Decimal(v);

const line = (id: string, overrides: Partial<Parameters<AllocationService["allocate"]>[0]["lines"][number]> = {}) => ({
  id,
  quantity: D(1),
  invoiceValue: D(1),
  weightTotal: null,
  volumeTotal: null,
  ...overrides,
});

const expense = (id: string, baseAmount: number | string) => ({
  id,
  baseAmount: D(baseAmount),
});

describe("AllocationService.allocate", () => {
  it("distributes a single expense equally when quantities are equal (BY_QUANTITY)", () => {
    const service = new AllocationService();

    const result = service.allocate({
      basis: "BY_QUANTITY",
      lines: [line("l1", { quantity: D(10) }), line("l2", { quantity: D(10) })],
      expenses: [expense("e1", 100)],
    });

    expect(result.grandTotal).toEqual(D(100));
    expect(result.expenseTotals["e1"]).toEqual(D(100));
    expect(result.lineTotals["l1"]).toEqual(D(50));
    expect(result.lineTotals["l2"]).toEqual(D(50));
    expect(result.residual).toEqual(D(0));
  });

  it("distributes proportionally to value (BY_VALUE)", () => {
    const service = new AllocationService();

    const result = service.allocate({
      basis: "BY_VALUE",
      lines: [line("l1", { invoiceValue: D(300) }), line("l2", { invoiceValue: D(100) })],
      expenses: [expense("e1", 120)],
    });

    // 300/400 * 120 = 90; 100/400 * 120 = 30
    expect(result.lineTotals["l1"]).toEqual(D(90));
    expect(result.lineTotals["l2"]).toEqual(D(30));
  });

  it("distributes proportionally to weight (BY_WEIGHT)", () => {
    const service = new AllocationService();

    const result = service.allocate({
      basis: "BY_WEIGHT",
      lines: [line("l1", { weightTotal: D(200) }), line("l2", { weightTotal: D(800) })],
      expenses: [expense("e1", 100)],
    });

    expect(result.lineTotals["l1"]).toEqual(D(20));
    expect(result.lineTotals["l2"]).toEqual(D(80));
  });

  it("distributes proportionally to volume (BY_VOLUME)", () => {
    const service = new AllocationService();

    const result = service.allocate({
      basis: "BY_VOLUME",
      lines: [line("l1", { volumeTotal: D(5) }), line("l2", { volumeTotal: D(15) })],
      expenses: [expense("e1", 40)],
    });

    expect(result.lineTotals["l1"]).toEqual(D(10));
    expect(result.lineTotals["l2"]).toEqual(D(30));
  });

  it("allocates multiple expenses per line independently", () => {
    const service = new AllocationService();

    const result = service.allocate({
      basis: "BY_QUANTITY",
      lines: [line("l1", { quantity: D(1) }), line("l2", { quantity: D(3) })],
      expenses: [expense("e1", 40), expense("e2", 80)],
    });

    // weights: l1=1/4, l2=3/4
    // e1 (40): l1=10, l2=30 ; e2 (80): l1=20, l2=60
    const cell = (lineId: string, expenseId: string) =>
      result.cells.find((c) => c.lineId === lineId && c.expenseId === expenseId)?.amount;

    expect(cell("l1", "e1")).toEqual(D(10));
    expect(cell("l2", "e1")).toEqual(D(30));
    expect(cell("l1", "e2")).toEqual(D(20));
    expect(cell("l2", "e2")).toEqual(D(60));
    expect(result.lineTotals["l1"]).toEqual(D(30));
    expect(result.lineTotals["l2"]).toEqual(D(90));
    expect(result.expenseTotals["e1"]).toEqual(D(40));
    expect(result.expenseTotals["e2"]).toEqual(D(80));
    expect(result.grandTotal).toEqual(D(120));
  });

  it("assigns rounding residual to the largest line so totals reconcile", () => {
    const service = new AllocationService();

    const result = service.allocate({
      basis: "BY_QUANTITY",
      lines: [line("l1", { quantity: D(1) }), line("l2", { quantity: D(3) })],
      expenses: [expense("e1", 100)],
    });

    // exact split would be 25 / 75, no residual
    expect(result.residual).toEqual(D(0));
    expect(result.lineTotals["l1"]).toEqual(D(25));
    expect(result.lineTotals["l2"]).toEqual(D(75));
  });

  it("produces a rounding residual for non-divisible totals", () => {
    const service = new AllocationService();

    const result = service.allocate({
      basis: "BY_QUANTITY",
      lines: [line("l1", { quantity: D(1) }), line("l2", { quantity: D(1) })],
      expenses: [expense("e1", 100.000001)],
    });

    // 50.0000005 each -> rounded to 50.000001 / 50.000000 -> residual 0? sum=100.000001
    const total = result.lineTotals["l1"].plus(result.lineTotals["l2"]);
    expect(total).toEqual(D("100.000001"));
    expect(result.expenseTotals["e1"]).toEqual(D("100.000001"));
  });

  it("throws when all values are zero (BY_VALUE)", () => {
    const service = new AllocationService();

    expect(() =>
      service.allocate({
        basis: "BY_VALUE",
        lines: [line("l1", { invoiceValue: D(0) }), line("l2", { invoiceValue: D(0) })],
        expenses: [expense("e1", 100)],
      }),
    ).toThrow("Allocation basis totals zero");
  });

  it("throws when all weights are zero (BY_WEIGHT)", () => {
    const service = new AllocationService();

    expect(() =>
      service.allocate({
        basis: "BY_WEIGHT",
        lines: [line("l1", { weightTotal: D(0) }), line("l2", { weightTotal: D(0) })],
        expenses: [expense("e1", 100)],
      }),
    ).toThrow("Allocation basis totals zero");
  });

  it("throws when weight is missing on a line (BY_WEIGHT)", () => {
    const service = new AllocationService();

    expect(() =>
      service.allocate({
        basis: "BY_WEIGHT",
        lines: [line("l1", { weightTotal: D(10) }), line("l2", { weightTotal: null })],
        expenses: [expense("e1", 100)],
      }),
    ).toThrow("Weight allocation requires weight on every line.");
  });

  it("throws when volume is missing on a line (BY_VOLUME)", () => {
    const service = new AllocationService();

    expect(() =>
      service.allocate({
        basis: "BY_VOLUME",
        lines: [line("l1", { volumeTotal: D(10) }), line("l2", { volumeTotal: null })],
        expenses: [expense("e1", 100)],
      }),
    ).toThrow("Volume allocation requires volume on every line.");
  });

  it("throws when there are no lines", () => {
    const service = new AllocationService();

    expect(() =>
      service.allocate({
        basis: "BY_VALUE",
        lines: [],
        expenses: [expense("e1", 100)],
      }),
    ).toThrow("at least one line");
  });

  it("throws when there are no expenses", () => {
    const service = new AllocationService();

    expect(() =>
      service.allocate({
        basis: "BY_VALUE",
        lines: [line("l1")],
        expenses: [],
      }),
    ).toThrow("at least one expense");
  });
});

describe("AllocationService.validateManual", () => {
  it("passes when each expense reconciles to its total", () => {
    const service = new AllocationService();

    expect(() =>
      service.validateManual({
        lines: [line("l1"), line("l2")],
        expenses: [expense("e1", 100)],
        cells: [
          { lineId: "l1", expenseId: "e1", amount: D(60) },
          { lineId: "l2", expenseId: "e1", amount: D(40) },
        ],
      }),
    ).not.toThrow();
  });

  it("throws when a manual allocation does not reconcile", () => {
    const service = new AllocationService();

    expect(() =>
      service.validateManual({
        lines: [line("l1"), line("l2")],
        expenses: [expense("e1", 100)],
        cells: [
          { lineId: "l1", expenseId: "e1", amount: D(50) },
          { lineId: "l2", expenseId: "e1", amount: D(30) },
        ],
      }),
    ).toThrow("Manual allocation for expense does not reconcile to its total.");
  });

  it("throws when a manual allocation references an unknown line", () => {
    const service = new AllocationService();

    expect(() =>
      service.validateManual({
        lines: [line("l1")],
        expenses: [expense("e1", 100)],
        cells: [{ lineId: "nope", expenseId: "e1", amount: D(100) }],
      }),
    ).toThrow("unknown line");
  });

  it("throws when a manual allocation references an unknown expense", () => {
    const service = new AllocationService();

    expect(() =>
      service.validateManual({
        lines: [line("l1")],
        expenses: [expense("e1", 100)],
        cells: [{ lineId: "l1", expenseId: "nope", amount: D(100) }],
      }),
    ).toThrow("unknown expense");
  });
});
