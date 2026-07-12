"use client";

import { CreditCard } from "lucide-react";
import { useState, useTransition } from "react";

import { recordPaymentAction } from "../../domains/sales/actions/record-payment";

type InvoiceOpt = {
  id: string; invoiceNumber: string; customerName: string;
  totalAmount: number; amountPaid: number; currency: string;
  customerId: string; customerOutstanding: number;
};

export function RecordPaymentForm({ invoices, preselectedInvoiceId }: { invoices: InvoiceOpt[]; preselectedInvoiceId?: string }) {
  const [isPending, startTransition] = useTransition();
  const [invoiceId, setInvoiceId] = useState(preselectedInvoiceId ?? "");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("KWD");
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedInvoice = invoices.find((inv) => inv.id === invoiceId);
  const balance = selectedInvoice ? selectedInvoice.totalAmount - selectedInvoice.amountPaid : 0;

  function record() {
    if (!invoiceId) { setError("Please select an invoice."); return; }
    if (!amount || Number.parseFloat(amount) <= 0) { setError("Amount must be greater than zero."); return; }
    if (Number.parseFloat(amount) > balance) { setError(`Amount exceeds the outstanding balance (${balance.toFixed(3)}).`); return; }

    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await recordPaymentAction({
        invoiceId, amount, currency, method, reference: reference || undefined,
        paidAt: paidAt || undefined, notes: notes || undefined,
      });
      if (!result.ok) { setError(result.message ?? "Unable to record payment."); return; }
      setMessage("Payment recorded successfully.");
      setTimeout(() => { window.location.href = `/invoices/${invoiceId}`; }, 1500);
    });
  }

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CreditCard className="size-10 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">No payable invoices available.</p>
        <p className="mt-1 text-xs text-muted-foreground">All invoices are either fully paid or not yet issued.</p>
      </div>
    );
  }

  return (
    <section className="rounded-lg border p-5">
      <h2 className="text-sm font-semibold">Payment Details</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-medium">Invoice *</span>
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={invoiceId} onChange={(e) => { setInvoiceId(e.target.value); setError(null); }}>
            <option value="" disabled>Select an invoice...</option>
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.invoiceNumber} - {inv.customerName} ({inv.currency} {(inv.totalAmount - inv.amountPaid).toFixed(3)} outstanding)
              </option>
            ))}
          </select>
          {selectedInvoice ? (
            <div className="mt-1 space-y-0.5 text-xs">
              <p className="text-muted-foreground">Invoice outstanding: {balance.toFixed(3)} {selectedInvoice.currency}</p>
              <p className={selectedInvoice.customerOutstanding > 0 ? "text-amber-600" : "text-emerald-600"}>
                Customer Outstanding: {selectedInvoice.customerOutstanding.toFixed(3)}
              </p>
            </div>
          ) : null}
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Amount *</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-right text-sm outline-none focus:border-primary"
            min="0.001" max={balance || undefined} step="0.001" type="number" value={amount}
            onChange={(e) => setAmount(e.target.value)} />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Currency</span>
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="KWD">KWD</option><option value="USD">USD</option><option value="EUR">EUR</option>
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Method *</span>
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="CASH">Cash</option><option value="CHEQUE">Cheque</option>
            <option value="BANK_TRANSFER">Bank Transfer</option><option value="CREDIT_CARD">Credit Card</option>
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Reference</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Cheque or transaction ref..." />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Payment Date</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </label>

        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium">Notes</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." />
        </label>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          disabled={isPending} type="button" onClick={record}>
          <CreditCard className="size-4" />{isPending ? "Recording..." : "Record Payment"}
        </button>
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-500">{message}</p> : null}
      </div>
    </section>
  );
}
