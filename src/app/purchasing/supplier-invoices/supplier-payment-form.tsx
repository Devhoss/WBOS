"use client";

import { CreditCard } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { recordSupplierPayment } from "@/domains/supplier-invoices/actions/record-supplier-payment";

export function SupplierPaymentForm({
  invoiceId,
  currency,
  totalAmount,
  amountPaid,
}: {
  invoiceId: string;
  currency: string;
  totalAmount: number;
  amountPaid: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const balance = totalAmount - amountPaid;

  async function record() {
    const value = Number.parseFloat(amount);
    if (!value || value <= 0) { setError("Amount must be greater than zero."); return; }
    if (value > balance) { setError(`Amount exceeds the outstanding balance (${balance.toFixed(3)}).`); return; }

    setError(null);
    setIsPending(true);
    try {
      const result = await recordSupplierPayment({
        supplierInvoiceId: invoiceId,
        amount: value,
        currency,
        method,
        reference: reference || undefined,
        paidAt: paidAt || undefined,
        notes: notes || undefined,
      });
      if (!result.ok) { setError(result.message ?? "Unable to record payment."); setIsPending(false); return; }
      router.refresh();
      setAmount("");
      setReference("");
      setNotes("");
    } catch { setError("An unexpected error occurred."); }
    setIsPending(false);
  }

  return (
    <section className="rounded-lg border p-5">
      <h2 className="text-sm font-semibold">Record Payment</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Outstanding balance: <strong className="font-mono">{balance.toFixed(3)} {currency}</strong>
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-medium">Amount *</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-right text-sm outline-none focus:border-primary" min="0.001" max={balance || undefined} step="0.001" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Method *</span>
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="CASH">Cash</option>
            <option value="CHEQUE">Cheque</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="CREDIT_CARD">Credit Card</option>
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Reference</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bank transfer or cheque ref..." />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Payment Date</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </label>

        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium">Notes</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60" disabled={isPending} type="button" onClick={record}>
          <CreditCard className="size-4" />{isPending ? "Recording..." : "Record Payment"}
        </button>
        <button className="inline-flex h-10 items-center rounded-md border px-3 text-sm font-medium transition hover:bg-muted disabled:opacity-60" disabled={isPending || balance <= 0} type="button" onClick={() => setAmount((balance / 2).toFixed(3))}>
          Record Deposit (50%)
        </button>
        <button className="inline-flex h-10 items-center rounded-md border px-3 text-sm font-medium transition hover:bg-muted disabled:opacity-60" disabled={isPending || balance <= 0} type="button" onClick={() => setAmount(balance.toFixed(3))}>
          Record Final Payment
        </button>
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
      </div>
    </section>
  );
}