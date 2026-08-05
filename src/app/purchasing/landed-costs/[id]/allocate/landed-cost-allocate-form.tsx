"use client";

import { CheckCircle } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { postLandedCost } from "@/domains/purchasing/actions/post-landed-cost";
import { saveLandedCostAllocations } from "@/domains/purchasing/actions/save-landed-cost-allocations";

type AllocateLine = {
  id: string;
  productName: string;
  warehouseName: string;
  unitCode: string;
  quantity: number;
  invoiceValue: number;
  weightTotal: number | null;
  volumeTotal: number | null;
  onHand: number;
  postingTreatment: "CAPITALIZED" | "EXPENSED";
};

type AllocateExpense = {
  id: string;
  expenseType: string;
  description: string | null;
  baseAmount: number;
  amount: number;
  currency: string;
  exchangeRate: number;
};

type Cell = { lineId: string; expenseId: string; amount: number };

const ALLOCATION_BASES = [
  { value: "BY_VALUE", label: "By Value" },
  { value: "BY_QUANTITY", label: "By Quantity" },
  { value: "BY_WEIGHT", label: "By Weight" },
  { value: "BY_VOLUME", label: "By Volume" },
  { value: "MANUAL", label: "Manual" },
] as const;

const DECIMAL_PLACES = 6;

function computeAllocation(
  basis: string,
  lines: AllocateLine[],
  expenses: AllocateExpense[],
): { cells: Cell[]; lineTotals: Record<string, number>; grandTotal: number; residual: number } {
  const weights = lines.map((line) => {
    switch (basis) {
      case "BY_VALUE":
        return line.invoiceValue;
      case "BY_QUANTITY":
        return line.quantity;
      case "BY_WEIGHT":
        return line.weightTotal ?? 0;
      case "BY_VOLUME":
        return line.volumeTotal ?? 0;
      default:
        return 0;
    }
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  if (totalWeight <= 0) {
    return { cells: [], lineTotals: {}, grandTotal: 0, residual: 0 };
  }

  const cells: Cell[] = [];
  let residual = 0;

  for (const expense of expenses) {
    const lineAmounts = lines.map((line, index) => ({
      line,
      amount: round((expense.baseAmount * weights[index]) / totalWeight),
    }));

    const allocatedSum = lineAmounts.reduce((sum, item) => sum + item.amount, 0);
    const expenseResidual = round(expense.baseAmount - allocatedSum);
    residual += expenseResidual;

    if (Math.abs(expenseResidual) > 0 && lineAmounts.length > 0) {
      const largest = lineAmounts.reduce((a, b) => (a.amount > b.amount ? a : b));
      largest.amount = round(largest.amount + expenseResidual);
    }

    for (const item of lineAmounts) {
      cells.push({ lineId: item.line.id, expenseId: expense.id, amount: item.amount });
    }
  }

  const lineTotals: Record<string, number> = {};
  let grandTotal = 0;

  for (const cell of cells) {
    lineTotals[cell.lineId] = (lineTotals[cell.lineId] ?? 0) + cell.amount;
    grandTotal += cell.amount;
  }

  return { cells, lineTotals, grandTotal, residual };
}

function round(value: number): number {
  return Math.round(value * 10 ** DECIMAL_PLACES) / 10 ** DECIMAL_PLACES;
}

function formatExpenseType(type: string): string {
  return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function LandedCostAllocateForm({
  id,
  lcNumber,
  currency,
  supplierName,
  allocationBasis,
  lines,
  expenses,
  initialCells,
}: {
  id: string;
  lcNumber: string;
  currency: string;
  supplierName: string;
  allocationBasis: string;
  lines: AllocateLine[];
  expenses: AllocateExpense[];
  initialCells: Cell[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [basis, setBasis] = useState(allocationBasis);
  const [manualCells, setManualCells] = useState<Cell[]>(
    initialCells.length > 0
      ? initialCells
      : lines.flatMap((line) =>
          expenses.map((expense) => ({ lineId: line.id, expenseId: expense.id, amount: 0 })),
        ),
  );

  const result = useMemo(() => {
    if (basis === "MANUAL") {
      const lineTotals: Record<string, number> = {};
      const expenseTotals: Record<string, number> = {};
      let grandTotal = 0;

      for (const cell of manualCells) {
        lineTotals[cell.lineId] = (lineTotals[cell.lineId] ?? 0) + cell.amount;
        expenseTotals[cell.expenseId] = (expenseTotals[cell.expenseId] ?? 0) + cell.amount;
        grandTotal += cell.amount;
      }

      const expenseTotal = expenses.reduce((sum, e) => sum + e.baseAmount, 0);
      const residual = round(expenseTotal - grandTotal);

      return { cells: manualCells, lineTotals, expenseTotals, grandTotal, residual, balanced: Math.abs(residual) <= 0.000001 };
    }

    const computed = computeAllocation(basis, lines, expenses);
    const expenseTotal = expenses.reduce((sum, e) => sum + e.baseAmount, 0);
    return {
      ...computed,
      expenseTotals: {},
      balanced: Math.abs(round(expenseTotal - computed.grandTotal)) <= 0.000001,
    };
  }, [basis, lines, expenses, manualCells]);

  function updateManualCell(lineId: string, expenseId: string, amount: string) {
    setManualCells((current) =>
      current.map((cell) =>
        cell.lineId === lineId && cell.expenseId === expenseId
          ? { ...cell, amount: Number.parseFloat(amount) || 0 }
          : cell,
      ),
    );
  }

  async function saveManual() {
    setMessage(null);
    const cells = manualCells.filter((cell) => cell.amount > 0);
    if (cells.length === 0) {
      setMessage("Allocate at least one cell.");
      return;
    }
    const result = await saveLandedCostAllocations({ id, cells });
    if (!result.ok) { setMessage(result.message ?? null); return; }
    setMessage("Allocation saved.");
    router.refresh();
  }

  async function post() {
    setMessage(null);
    if (!window.confirm(`Post ${lcNumber}? This revalues on-hand inventory and cannot be reversed except by cancellation.`)) return;
    const result = await postLandedCost({ id });
    if (!result.ok) { setMessage(result.message ?? null); return; }
    router.refresh();
    router.push(`/purchasing/landed-costs/${id}`);
  }

  const expenseTotal = expenses.reduce((sum, e) => sum + e.baseAmount, 0);

  return (
    <section className="rounded-lg border p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">{supplierName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Total expenses: <span className="font-mono tabular-nums">{expenseTotal.toFixed(3)} {currency}</span>
          </p>
        </div>
        <button
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          disabled={isPending}
          type="button"
          onClick={post}
        >
          <CheckCircle className="size-4" />
          {isPending ? "Posting..." : "Post Landed Cost"}
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <label className="space-y-2 text-sm">
          <span className="font-medium">Allocation Basis</span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={basis}
            onChange={(e) => setBasis(e.target.value)}
          >
            {ALLOCATION_BASES.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </label>
        <div
          className={`mt-4 rounded-md px-3 py-2 text-xs font-medium ${
            result.balanced
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
              : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
          }`}
        >
          {result.balanced
            ? "Allocation reconciles: allocated equals expense total."
            : `Out of balance by ${Math.abs(result.residual).toFixed(6)} ${currency}.`}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
            <tr className="border-b">
              <th className="h-10 px-3 text-left">Line</th>
              <th className="h-10 px-3 text-right">On Hand</th>
              <th className="h-10 px-3 text-left">Treatment</th>
              {expenses.map((expense) => (
                <th key={expense.id} className="h-10 px-3 text-right">
                  <div>{formatExpenseType(expense.expenseType)}</div>
                  <div className="font-mono font-normal">{expense.baseAmount.toFixed(3)}</div>
                </th>
              ))}
              <th className="h-10 px-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="border-b last:border-b-0 hover:bg-muted/30">
                <td className="h-10 px-3">
                  <div className="font-medium">{line.productName}</div>
                  <div className="text-xs text-muted-foreground">
                    {line.warehouseName} &middot; {line.quantity.toFixed(3)} {line.unitCode}
                  </div>
                </td>
                <td className="h-10 px-3 text-right font-mono tabular-nums">{line.onHand.toFixed(3)}</td>
                <td className="h-10 px-3">
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                      line.postingTreatment === "CAPITALIZED"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                  >
                    {line.postingTreatment}
                  </span>
                </td>
                {expenses.map((expense) => {
                  if (basis === "MANUAL") {
                    const cell = manualCells.find(
                      (c) => c.lineId === line.id && c.expenseId === expense.id,
                    );
                    return (
                      <td key={expense.id} className="p-2">
                        <input
                          className="h-9 w-28 rounded-md border bg-background px-2 text-right font-mono text-xs outline-none focus:border-primary"
                          min="0"
                          step="0.000001"
                          type="number"
                          value={cell?.amount ?? 0}
                          onChange={(e) => updateManualCell(line.id, expense.id, e.target.value)}
                        />
                      </td>
                    );
                  }

                  const cell = result.cells.find(
                    (c) => c.lineId === line.id && c.expenseId === expense.id,
                  );
                  return (
                    <td key={expense.id} className="h-10 px-3 text-right font-mono tabular-nums">
                      {cell ? cell.amount.toFixed(6) : "—"}
                    </td>
                  );
                })}
                <td className="h-10 px-3 text-right font-mono tabular-nums font-semibold">
                  {(result.lineTotals[line.id] ?? 0).toFixed(6)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/30">
            <tr>
              <td className="h-10 px-3 font-semibold">Total</td>
              <td className="h-10 px-3" />
              <td className="h-10 px-3" />
              {expenses.map((expense) => {
                const total = result.cells
                  .filter((c) => c.expenseId === expense.id)
                  .reduce((sum, c) => sum + c.amount, 0);
                return (
                  <td key={expense.id} className="h-10 px-3 text-right font-mono tabular-nums font-semibold">
                    {total.toFixed(6)}
                  </td>
                );
              })}
              <td className="h-10 px-3 text-right font-mono tabular-nums font-semibold">
                {result.grandTotal.toFixed(6)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-3">
        {basis === "MANUAL" ? (
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition hover:bg-muted disabled:opacity-60"
            disabled={isPending}
            type="button"
            onClick={() => startTransition(() => void saveManual())}
          >
            {isPending ? "Saving..." : "Save Manual Allocation"}
          </button>
        ) : null}
        {message ? (
          <p
            className={`text-sm ${message.startsWith("Allocation saved") ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}
          >
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
