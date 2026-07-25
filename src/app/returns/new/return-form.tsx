"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { createReturnAction } from "@/domains/returns/actions/create-return";
import type { CreateReturnOrderInput } from "@/domains/returns/validation/return-order-schema";
import { uid } from "@/lib/uid";

type ProductOption = { id: string; sku: string; name: string; defaultSellingPrice: number; unitOfMeasureId: string; unitOfMeasureCode: string };
type CustomerOption = { id: string; name: string; code: string | null };
type SalesOrderOption = { id: string; soNumber: string; customerId: string; customerName: string };

const REASONS = [
  { value: "CUSTOMER_CHANGED_MIND", label: "Customer Changed Mind" },
  { value: "DAMAGED", label: "Damaged" },
  { value: "WRONG_PRODUCT", label: "Wrong Product" },
  { value: "DEFECTIVE", label: "Defective" },
  { value: "EXPIRED", label: "Expired" },
  { value: "RECALL", label: "Recall" },
  { value: "OTHER", label: "Other" },
];

type ReturnLine = {
  id: string;
  productId: string;
  unitOfMeasureId: string;
  expectedQuantity: string;
  unitPrice: string;
  unitOfMeasureCode: string;
  productName: string;
  productSku: string;
};

function createLine(): ReturnLine {
  return {
    id: uid(),
    productId: "", unitOfMeasureId: "", expectedQuantity: "", unitPrice: "",
    unitOfMeasureCode: "", productName: "", productSku: "",
  };
}

export function ReturnForm({
  preselectedSalesOrderId, preselectedInvoiceId, preselectedCustomerId, customers, products, salesOrders,
}: {
  preselectedSalesOrderId?: string; preselectedInvoiceId?: string; preselectedCustomerId?: string;
  customers: CustomerOption[]; products: ProductOption[]; salesOrders: SalesOrderOption[];
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [lines, setLines] = useState<ReturnLine[]>([createLine()]);
  const [message, setMessage] = useState<string | null>(null);

  const preselectedSO = salesOrders.find((so) => so.id === preselectedSalesOrderId);
  const [customerId, setCustomerId] = useState(preselectedSO?.customerId ?? preselectedCustomerId ?? "");
  const [salesOrderId, setSalesOrderId] = useState(preselectedSalesOrderId ?? "");
  const [invoiceId, setInvoiceId] = useState(preselectedInvoiceId ?? "");
  const [reason, setReason] = useState("CUSTOMER_CHANGED_MIND");
  const [notes, setNotes] = useState("");

  function updateLine(id: string, field: keyof ReturnLine, value: string) {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;

        if (field === "productId" && value) {
          const product = products.find((p) => p.id === value);
          if (product) {
            return {
              ...line,
              productId: value,
              productName: product.name,
              productSku: product.sku,
              unitOfMeasureId: product.unitOfMeasureId,
              unitOfMeasureCode: product.unitOfMeasureCode,
              unitPrice: product.defaultSellingPrice.toString(),
            };
          }
        }

        return { ...line, [field]: value };
      }),
    );
  }

  function removeLine(id: string) {
    if (lines.length === 1) return;
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!customerId) {
      setMessage("Customer is required.");
      return;
    }

    const payload = {
      customerId,
      salesOrderId: salesOrderId || undefined,
      invoiceId: invoiceId || undefined,
      reason: reason as CreateReturnOrderInput["reason"],
      notes: notes || undefined,
      lines: lines.map((l) => ({
        productId: l.productId,
        unitOfMeasureId: l.unitOfMeasureId,
        expectedQuantity: Number.parseFloat(l.expectedQuantity),
        unitPrice: Number.parseFloat(l.unitPrice),
      })),
    };

    setIsPending(true);
    try {
      const result = await createReturnAction(payload);
      if (!result.ok) {
        setMessage(result.message ?? null);
        setIsPending(false);
      } else {
        setIsPending(false);
        if (result.data?.id) {
          router.push(`/returns/${result.data.id}`);
        } else {
          setMessage("Return was created but could not navigate to it. Please refresh.");
        }
      }
    } catch {
      setMessage("An unexpected error occurred.");
      setIsPending(false);
    }
  }

  const filteredSalesOrders = salesOrders.filter(
    (so) => !customerId || so.customerId === customerId,
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {message && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{message}</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Customer</label>
          <select
            value={customerId}
            onChange={(e) => { setCustomerId(e.target.value); setSalesOrderId(""); }}
            className="w-full rounded-md border px-3 py-2 text-sm"
            required
          >
            <option value="">Select customer...</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name} {c.code ? `(${c.code})` : ""}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Sales Order</label>
          <select
            value={salesOrderId}
            onChange={(e) => setSalesOrderId(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">No sales order (optional)</option>
            {filteredSalesOrders.map((so) => (
              <option key={so.id} value={so.id}>{so.soNumber} - {so.customerName}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Reason</label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        >
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Return Items</h3>
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, createLine()])}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <Plus className="size-3.5" /> Add Item
          </button>
        </div>

        {lines.map((line) => (
          <div key={line.id} className="flex items-start gap-3 rounded-md border p-3">
            <div className="flex-1 space-y-2">
              <select
                value={line.productId}
                onChange={(e) => updateLine(line.id, "productId", e.target.value)}
                className="w-full rounded-md border px-2 py-1.5 text-sm"
                required
              >
                <option value="">Select product...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
                ))}
              </select>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-muted-foreground">Qty</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={line.expectedQuantity}
                    onChange={(e) => updateLine(line.id, "expectedQuantity", e.target.value)}
                    className="w-full rounded-md border px-2 py-1.5 text-sm"
                    required
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-muted-foreground">Unit Price</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={line.unitPrice}
                    onChange={(e) => updateLine(line.id, "unitPrice", e.target.value)}
                    className="w-full rounded-md border px-2 py-1.5 text-sm"
                    required
                  />
                </div>
                <div className="flex items-center pt-4">
                  <span className="text-xs text-muted-foreground">{line.unitOfMeasureCode}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => removeLine(line.id)}
              className="mt-1 shrink-0 text-muted-foreground hover:text-red-500"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 border-t pt-6">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-9 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Creating..." : "Create Return"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium transition hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
