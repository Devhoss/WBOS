"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { updateLandedCost } from "../../../../../domains/purchasing/actions/update-landed-cost";
import { uid } from "@/lib/uid";

type SupplierOption = { id: string; name: string };

type Expense = {
  id: string;
  expenseType: string;
  description: string;
  currency: string;
  exchangeRate: string;
  amount: string;
};

type Line = {
  id: string;
  productName: string;
  warehouseName: string;
  unitCode: string;
  quantity: number;
  invoiceValue: string;
  weightTotal: string;
  volumeTotal: string;
};

const EXPENSE_TYPES = [
  "OCEAN_FREIGHT",
  "AIR_FREIGHT",
  "CUSTOMS_TAX",
  "INSURANCE",
  "CUSTOMS_BROKER",
  "LOCAL_TRANSPORT",
  "PORT_FEES",
  "DOCUMENTATION",
  "OTHER",
] as const;

const ALLOCATION_BASES = [
  { value: "BY_VALUE", label: "By Value" },
  { value: "BY_QUANTITY", label: "By Quantity" },
  { value: "BY_WEIGHT", label: "By Weight" },
  { value: "BY_VOLUME", label: "By Volume" },
  { value: "MANUAL", label: "Manual" },
] as const;

function formatExpenseType(type: string): string {
  return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function LandedCostEditForm({
  id,
  lcNumber,
  suppliers,
  initial,
  expenses,
  lines,
}: {
  id: string;
  lcNumber: string;
  suppliers: SupplierOption[];
  initial: {
    supplierId: string;
    allocationBasis: string;
    postingDate: string;
    currency: string;
    exchangeRate: string;
    notes: string;
  };
  expenses: Expense[];
  lines: Line[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState(initial.supplierId);
  const [allocationBasis, setAllocationBasis] = useState(initial.allocationBasis);
  const [postingDate, setPostingDate] = useState(initial.postingDate);
  const [currency, setCurrency] = useState(initial.currency);
  const [exchangeRate, setExchangeRate] = useState(initial.exchangeRate);
  const [notes, setNotes] = useState(initial.notes);
  const [expenseState, setExpenseState] = useState<Expense[]>(expenses);
  const [lineState, setLineState] = useState<Line[]>(lines);

  function updateLine(lineId: string, patch: Partial<Line>) {
    setLineState((current) => current.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  }

  const totalExpense = useMemo(
    () =>
      expenseState.reduce((sum, e) => {
        const amount = Number.parseFloat(e.amount) || 0;
        const rate = Number.parseFloat(e.exchangeRate) || 1;
        return sum + amount * rate;
      }, 0),
    [expenseState],
  );

  const basisLabel =
    allocationBasis === "BY_VALUE"
      ? "invoice value"
      : allocationBasis === "BY_QUANTITY"
        ? "quantity"
        : allocationBasis === "BY_WEIGHT"
          ? "weight"
          : allocationBasis === "BY_VOLUME"
            ? "volume"
            : "manual";

  function updateExpense(expenseId: string, patch: Partial<Expense>) {
    setExpenseState((current) => current.map((e) => (e.id === expenseId ? { ...e, ...patch } : e)));
  }

  function submit() {
    setMessage(null);

    startTransition(async () => {
      const result = await updateLandedCost({
        id,
        supplierId: supplierId || undefined,
        allocationBasis,
        postingDate: postingDate || undefined,
        currency,
        exchangeRate,
        notes: notes || undefined,
        expenses: expenseState.map((e) => ({
          expenseType: e.expenseType,
          description: e.description || undefined,
          currency: e.currency,
          exchangeRate: e.exchangeRate,
          amount: e.amount,
        })),
        lines: lineState.map((line) => ({
          id: line.id,
          invoiceValue: line.invoiceValue,
          weightTotal: line.weightTotal ? Number(line.weightTotal) : undefined,
          volumeTotal: line.volumeTotal ? Number(line.volumeTotal) : undefined,
        })),
      });

      if (!result.ok) {
        setMessage(result.message ?? "Unable to update landed cost.");
        return;
      }

      setMessage("Landed cost updated.");
      router.refresh();
      router.push(`/purchasing/landed-costs/${id}`);
    });
  }

  return (
    <section className="rounded-lg border p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">{lcNumber}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Edit the details of this draft landed cost.
          </p>
        </div>
        <button
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          disabled={isPending}
          type="button"
          onClick={submit}
        >
          <Plus className="size-4" />
          {isPending ? "Saving" : "Save Changes"}
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="space-y-2 text-sm">
          <span className="font-medium">Supplier</span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <option value="">Select supplier (optional)</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Allocation Basis</span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={allocationBasis}
            onChange={(e) => setAllocationBasis(e.target.value)}
          >
            {ALLOCATION_BASES.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Posting Date</span>
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            type="date"
            value={postingDate}
            onChange={(e) => setPostingDate(e.target.value)}
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Currency</span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option value="KWD">KWD</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Exchange Rate (to {currency})</span>
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            min="0"
            step="0.000001"
            type="number"
            value={exchangeRate}
            onChange={(e) => setExchangeRate(e.target.value)}
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Notes</span>
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-semibold">Lines</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Allocation basis is {basisLabel}. Lines are locked to their goods receipts.
        </p>
      </div>

      <div className="mt-3 overflow-x-auto rounded-md border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
            <tr className="border-b">
              <th className="h-10 px-3 text-left">Product</th>
              <th className="h-10 px-3 text-left">Warehouse</th>
              <th className="h-10 px-3 text-right">Qty</th>
              <th className="h-10 px-3 text-right">Invoice Value</th>
              <th className="h-10 px-3 text-right">Weight Total</th>
              <th className="h-10 px-3 text-right">Volume Total</th>
            </tr>
          </thead>
          <tbody>
            {lineState.map((line) => (
              <tr key={line.id} className="border-b last:border-b-0">
                <td className="h-10 px-3">
                  <span className="font-medium">{line.productName}</span>
                </td>
                <td className="h-10 px-3 text-muted-foreground">{line.warehouseName}</td>
                <td className="h-10 px-3 text-right font-mono tabular-nums">{line.quantity.toFixed(3)} {line.unitCode}</td>
                <td className="h-10 w-32 px-3">
                  <input
                    className="h-10 w-full rounded-md border bg-background px-3 text-right text-sm outline-none focus:border-primary"
                    min="0"
                    step="0.000001"
                    type="number"
                    value={line.invoiceValue}
                    onChange={(e) => updateLine(line.id, { invoiceValue: e.target.value })}
                  />
                </td>
                <td className="h-10 w-32 px-3">
                  <input
                    className="h-10 w-full rounded-md border bg-background px-3 text-right text-sm outline-none focus:border-primary"
                    min="0"
                    step="0.000001"
                    type="number"
                    value={line.weightTotal}
                    onChange={(e) => updateLine(line.id, { weightTotal: e.target.value })}
                  />
                </td>
                <td className="h-10 w-32 px-3">
                  <input
                    className="h-10 w-full rounded-md border bg-background px-3 text-right text-sm outline-none focus:border-primary"
                    min="0"
                    step="0.000001"
                    type="number"
                    value={line.volumeTotal}
                    onChange={(e) => updateLine(line.id, { volumeTotal: e.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-semibold">Expenses</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Amounts are converted to {currency} using each expense&apos;s exchange rate.
        </p>
      </div>

      <div className="mt-3 overflow-x-auto rounded-md border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
            <tr className="border-b">
              <th className="h-10 px-3 text-left">Type</th>
              <th className="h-10 px-3 text-left">Description</th>
              <th className="h-10 w-24 px-3 text-left">Currency</th>
              <th className="h-10 w-28 px-3 text-right">Exchange Rate</th>
              <th className="h-10 w-32 px-3 text-right">Amount</th>
              <th className="h-10 w-28 px-3 text-right">Base ({currency})</th>
              <th className="h-10 w-12 px-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {expenseState.map((expense) => (
              <tr key={expense.id} className="border-b last:border-b-0">
                <td className="p-3">
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                    value={expense.expenseType}
                    onChange={(e) => updateExpense(expense.id, { expenseType: e.target.value })}
                  >
                    {EXPENSE_TYPES.map((t) => (
                      <option key={t} value={t}>{formatExpenseType(t)}</option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <input
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                    value={expense.description}
                    onChange={(e) => updateExpense(expense.id, { description: e.target.value })}
                  />
                </td>
                <td className="p-3">
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                    value={expense.currency}
                    onChange={(e) => updateExpense(expense.id, { currency: e.target.value })}
                  >
                    <option value="KWD">KWD</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </td>
                <td className="p-3">
                  <input
                    className="h-10 w-full rounded-md border bg-background px-3 text-right text-sm outline-none focus:border-primary"
                    min="0"
                    step="0.000001"
                    type="number"
                    value={expense.exchangeRate}
                    onChange={(e) => updateExpense(expense.id, { exchangeRate: e.target.value })}
                  />
                </td>
                <td className="p-3">
                  <input
                    className="h-10 w-full rounded-md border bg-background px-3 text-right text-sm outline-none focus:border-primary"
                    min="0"
                    step="0.001"
                    type="number"
                    value={expense.amount}
                    onChange={(e) => updateExpense(expense.id, { amount: e.target.value })}
                  />
                </td>
                <td className="p-3 text-right font-mono text-sm tabular-nums">
                  {((Number.parseFloat(expense.amount) || 0) * (Number.parseFloat(expense.exchangeRate) || 1)).toFixed(3)}
                </td>
                <td className="p-3 text-right">
                  <button
                    className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                    disabled={expenseState.length === 1}
                    type="button"
                    onClick={() => setExpenseState((current) => current.filter((e) => e.id !== expense.id))}
                  >
                    <Trash2 className="size-4" />
                    <span className="sr-only">Remove expense</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition hover:bg-muted"
          type="button"
          onClick={() =>
            setExpenseState((current) => [
              ...current,
              {
                id: uid(),
                expenseType: "OCEAN_FREIGHT",
                description: "",
                currency: "KWD",
                exchangeRate: "1",
                amount: "",
              },
            ])
          }
        >
          <Plus className="size-4" />
          Add Expense
        </button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>

      <div className="mt-4 border-t pt-4">
        <div className="ml-auto flex w-full max-w-xs flex-col gap-2 text-sm">
          <div className="flex justify-between border-t pt-2 font-semibold">
            <span>Total Landed Cost</span>
            <span className="font-mono tabular-nums">{totalExpense.toFixed(3)} {currency}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
