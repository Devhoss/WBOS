import type { LandedCostAllocationBasis } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { BusinessError } from "@/shared/errors/business-error";

export type AllocationLineInput = {
  id: string;
  quantity: Prisma.Decimal.Value;
  invoiceValue: Prisma.Decimal.Value;
  weightTotal?: Prisma.Decimal.Value | null;
  volumeTotal?: Prisma.Decimal.Value | null;
};

export type AllocationExpenseInput = {
  id: string;
  baseAmount: Prisma.Decimal.Value;
};

export type AllocationCell = {
  lineId: string;
  expenseId: string;
  amount: Prisma.Decimal;
};

export type AllocationResult = {
  cells: AllocationCell[];
  lineTotals: Record<string, Prisma.Decimal>;
  expenseTotals: Record<string, Prisma.Decimal>;
  grandTotal: Prisma.Decimal;
  residual: Prisma.Decimal;
};

const DECIMAL_PLACES = 6;

export class AllocationService {
  allocate(
    input: {
      basis: LandedCostAllocationBasis;
      lines: AllocationLineInput[];
      expenses: AllocationExpenseInput[];
    },
  ): AllocationResult {
    if (input.lines.length === 0) {
      throw new BusinessError("Allocation requires at least one line.", "LANDED_COST_NO_LINES");
    }

    if (input.expenses.length === 0) {
      throw new BusinessError("Allocation requires at least one expense.", "LANDED_COST_NO_EXPENSES");
    }

    if (input.basis === "MANUAL") {
      throw new BusinessError("Manual allocation must be validated, not computed.", "LANDED_COST_MANUAL_NOT_COMPUTED");
    }

    const weights = this.computeWeights(input.basis, input.lines);
    const totalWeight = weights.reduce((sum, weight) => sum.plus(weight), new Prisma.Decimal(0));

    if (totalWeight.isZero()) {
      throw new BusinessError("Allocation basis totals zero; nothing can be allocated.", "LANDED_COST_ZERO_BASIS");
    }

    const cells: AllocationCell[] = [];
    let residual = new Prisma.Decimal(0);

    for (const expense of input.expenses) {
      const expenseTotal = new Prisma.Decimal(expense.baseAmount);

      const lineAmounts = input.lines.map((line, index) => ({
        line,
        amount: expenseTotal
          .mul(weights[index])
          .div(totalWeight)
          .toDecimalPlaces(DECIMAL_PLACES, Prisma.Decimal.ROUND_HALF_UP),
      }));

      const allocatedSum = lineAmounts.reduce(
        (sum, item) => sum.plus(item.amount),
        new Prisma.Decimal(0),
      );

      const expenseResidual = expenseTotal.minus(allocatedSum);
      residual = residual.plus(expenseResidual);

      if (!expenseResidual.isZero() && lineAmounts.length > 0) {
        const largest = lineAmounts.reduce((a, b) => (a.amount.gt(b.amount) ? a : b));
        largest.amount = largest.amount.plus(expenseResidual).toDecimalPlaces(DECIMAL_PLACES);
      }

      for (const item of lineAmounts) {
        cells.push({ lineId: item.line.id, expenseId: expense.id, amount: item.amount });
      }
    }

    const lineTotals: Record<string, Prisma.Decimal> = {};
    const expenseTotals: Record<string, Prisma.Decimal> = {};
    let grandTotal = new Prisma.Decimal(0);

    for (const cell of cells) {
      lineTotals[cell.lineId] = (lineTotals[cell.lineId] ?? new Prisma.Decimal(0)).plus(cell.amount);
      expenseTotals[cell.expenseId] = (expenseTotals[cell.expenseId] ?? new Prisma.Decimal(0)).plus(cell.amount);
      grandTotal = grandTotal.plus(cell.amount);
    }

    return { cells, lineTotals, expenseTotals, grandTotal, residual };
  }

  validateManual(
    input: {
      lines: AllocationLineInput[];
      expenses: AllocationExpenseInput[];
      cells: AllocationCell[];
    },
  ): void {
    if (input.lines.length === 0) {
      throw new BusinessError("Allocation requires at least one line.", "LANDED_COST_NO_LINES");
    }

    if (input.expenses.length === 0) {
      throw new BusinessError("Allocation requires at least one expense.", "LANDED_COST_NO_EXPENSES");
    }

    const tolerance = new Prisma.Decimal("0.000001");
    const knownLineIds = new Set(input.lines.map((line) => line.id));
    const knownExpenseIds = new Set(input.expenses.map((expense) => expense.id));

    for (const cell of input.cells) {
      if (!knownLineIds.has(cell.lineId)) {
        throw new BusinessError("Manual allocation references an unknown line.", "LANDED_COST_ALLOCATION_UNKNOWN_LINE");
      }

      if (!knownExpenseIds.has(cell.expenseId)) {
        throw new BusinessError("Manual allocation references an unknown expense.", "LANDED_COST_ALLOCATION_UNKNOWN_EXPENSE");
      }
    }

    for (const expense of input.expenses) {
      const total = input.cells
        .filter((cell) => cell.expenseId === expense.id)
        .reduce((sum, cell) => sum.plus(cell.amount), new Prisma.Decimal(0));

      const expected = new Prisma.Decimal(expense.baseAmount);

      if (total.minus(expected).abs().gt(tolerance)) {
        throw new BusinessError(
          `Manual allocation for expense does not reconcile to its total.`,
          "LANDED_COST_ALLOCATION_MISMATCH",
        );
      }
    }
  }

  private computeWeights(basis: LandedCostAllocationBasis, lines: AllocationLineInput[]): Prisma.Decimal[] {
    return lines.map((line) => {
      switch (basis) {
        case "BY_VALUE":
          return new Prisma.Decimal(line.invoiceValue);
        case "BY_QUANTITY":
          return new Prisma.Decimal(line.quantity);
        case "BY_WEIGHT": {
          if (line.weightTotal === null || line.weightTotal === undefined) {
            throw new BusinessError(
              "Weight allocation requires weight on every line.",
              "LANDED_COST_MISSING_WEIGHT",
            );
          }

          return new Prisma.Decimal(line.weightTotal);
        }
        case "BY_VOLUME": {
          if (line.volumeTotal === null || line.volumeTotal === undefined) {
            throw new BusinessError(
              "Volume allocation requires volume on every line.",
              "LANDED_COST_MISSING_VOLUME",
            );
          }

          return new Prisma.Decimal(line.volumeTotal);
        }
        default:
          throw new BusinessError(
            `Unsupported allocation basis: ${basis}`,
            "LANDED_COST_UNSUPPORTED_BASIS",
          );
      }
    });
  }
}
