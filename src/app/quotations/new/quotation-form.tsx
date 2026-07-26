"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { createQuotationAction } from "@/domains/quotations/actions/create-quotation";
import { uid } from "@/lib/uid";

type ProductOption = { id: string; name: string; sku: string; barcode: string | null; defaultSellingPrice: number | null; piecesPerBox: number | null; unitOfMeasure: { id: string; name: string; code: string } };
type CustomerOption = { id: string; name: string };
type UnitOption = { id: string; name: string; code: string };

type QtLine = {
  id: string;
  productId: string;
  unitOfMeasureId: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  productName: string;
  productSku: string;
  productBarcode: string;
  unitOfMeasureCode: string;
  piecesPerBox: string;
  description: string;
  notes: string;
};

function createLine(): QtLine {
  return {
    id: uid(), productId: "", unitOfMeasureId: "", quantity: "", unitPrice: "", totalPrice: "",
    productName: "", productSku: "", productBarcode: "", unitOfMeasureCode: "", piecesPerBox: "", description: "", notes: "",
  };
}

function calcTotal(q: string, p: string): string {
  const qty = Number.parseFloat(q);
  const prc = Number.parseFloat(p);
  if (Number.isNaN(qty) || Number.isNaN(prc)) return "";
  return (qty * prc).toFixed(3);
}

export function QuotationForm({
  customers, products, unitsOfMeasure,
}: {
  customers: CustomerOption[];
  products: ProductOption[];
  unitsOfMeasure: UnitOption[];
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [lines, setLines] = useState<QtLine[]>([createLine()]);
  const [message, setMessage] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [currency, setCurrency] = useState("KWD");
  const [taxAmount, setTaxAmount] = useState("0");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [discountType, setDiscountType] = useState<"" | "PERCENTAGE" | "FIXED">("");
  const [discountRate, setDiscountRate] = useState("");

  function updateLine(id: string, patch: Partial<QtLine>) {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== id) return line;
        const updated = { ...line, ...patch };

        if ("productId" in patch && patch.productId) {
          const product = products.find((p) => p.id === patch.productId);
          if (product) {
            updated.productName = product.name;
            updated.productSku = product.sku;
            updated.productBarcode = product.barcode ?? "";
            updated.unitOfMeasureId = product.unitOfMeasure.id;
            updated.unitOfMeasureCode = product.unitOfMeasure.code;
            updated.piecesPerBox = product.piecesPerBox != null ? String(product.piecesPerBox) : "";
            if (!updated.unitPrice || Number(updated.unitPrice) === 0) {
              updated.unitPrice = (product.defaultSellingPrice ?? 0).toFixed(3);
            }
          }
        }

        if ("quantity" in patch || "unitPrice" in patch) {
          updated.totalPrice = calcTotal(updated.quantity, updated.unitPrice);
        }
        return updated;
      }),
    );
  }

  function removeLine(id: string) {
    setLines((current) => (current.length === 1 ? current : current.filter((l) => l.id !== id)));
  }

  async function submit() {
    setMessage(null);

    const subtotal = lines.reduce((s, l) => s + (Number.parseFloat(l.totalPrice) || 0), 0);
    const tax = Number.parseFloat(taxAmount) || 0;

    let discountAmount = 0;
    if (discountType === "FIXED" && discountRate) {
      discountAmount = Number.parseFloat(discountRate) || 0;
    } else if (discountType === "PERCENTAGE" && discountRate) {
      discountAmount = subtotal * ((Number.parseFloat(discountRate) || 0) / 100);
    }

    const total = subtotal + tax - discountAmount;

    setIsPending(true);
    try {
      const result = await createQuotationAction({
        customerId,
        currency,
        subtotal: subtotal.toFixed(3),
        taxAmount,
        totalAmount: total.toFixed(3),
        discountAmount: discountAmount.toFixed(3),
        discountType: discountType || undefined,
        discountRate: discountRate || undefined,
        validUntil: validUntil || undefined,
        notes: notes || undefined,
        terms: terms || undefined,
        lines: lines.map((l) => ({
          productId: l.productId,
          unitOfMeasureId: l.unitOfMeasureId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          totalPrice: l.totalPrice,
          productName: l.productName,
          productSku: l.productSku,
          unitOfMeasureCode: l.unitOfMeasureCode,
          piecesPerBox: l.piecesPerBox ? Number(l.piecesPerBox) : undefined,
          productBarcode: l.productBarcode || undefined,
          description: l.description || undefined,
          notes: l.notes || undefined,
        })),
      });

      if (!result.ok) {
        setMessage(result.message ?? "Unable to create quotation.");
        setIsPending(false);
        return;
      }

      setIsPending(false);
      if (result.data?.id) {
        router.push(`/quotations/${result.data.id}`);
      } else {
        setMessage("Quotation created.");
        window.location.reload();
      }
    } catch {
      setMessage("An unexpected error occurred.");
      setIsPending(false);
    }
  }

  return (
    <section className="rounded-lg border p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Quotation Details</h2>
          <p className="mt-1 text-sm text-muted-foreground">Fill in the customer and line items to create the quotation.</p>
        </div>
        <button
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          disabled={isPending} type="button" onClick={submit}
        >
          <Plus className="size-4" />{isPending ? "Creating..." : "Create Quotation"}
        </button>
      </div>

      {message ? (
        <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{message}</div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="space-y-2 text-sm">
          <span className="font-medium">Customer <span className="text-destructive">*</span></span>
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Select customer</option>
            {customers.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Currency</span>
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="KWD">KWD</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Valid Until</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Notes</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Terms</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            value={terms} onChange={(e) => setTerms(e.target.value)} />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Tax Amount</span>
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            type="number" min="0" step="0.001" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} />
        </label>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold">Line Items</h3>
        <p className="mt-1 text-xs text-muted-foreground">Add at least one product to the quotation.</p>
      </div>

      <div className="mt-3 space-y-3">
        {lines.map((line) => (
          <div key={line.id} className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 p-3">
            <label className="min-w-[180px] flex-1 space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Product</span>
              <select className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:border-primary"
                value={line.productId} onChange={(e) => updateLine(line.id, { productId: e.target.value })}>
                <option value="">Select</option>
                {products.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </label>
            {line.productBarcode ? (
              <div className="min-w-[100px] flex-1 space-y-1 text-sm">
                <span className="text-xs font-medium text-muted-foreground">Barcode</span>
                <div className="h-9 rounded-md border bg-muted/50 px-2 text-sm leading-9 text-muted-foreground truncate">{line.productBarcode}</div>
              </div>
            ) : null}
            <label className="min-w-[100px] flex-1 space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">UOM</span>
              <select className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:border-primary"
                value={line.unitOfMeasureId} onChange={(e) => updateLine(line.id, { unitOfMeasureId: e.target.value, unitOfMeasureCode: unitsOfMeasure.find((u) => u.id === e.target.value)?.code ?? "" })}>
                {unitsOfMeasure.map((u) => (<option key={u.id} value={u.id}>{u.code}</option>))}
              </select>
            </label>
            {line.piecesPerBox ? (
              <div className="min-w-[60px] flex-1 space-y-1 text-sm">
                <span className="text-xs font-medium text-muted-foreground">PC/CTN · الوحدات/كرتون</span>
                <div className="h-9 rounded-md border bg-muted/50 px-2 text-sm leading-9 text-muted-foreground">{line.piecesPerBox}</div>
              </div>
            ) : null}
            <label className="min-w-[80px] flex-1 space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Qty</span>
              <input className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:border-primary"
                type="number" min="0" step="any" value={line.quantity} onChange={(e) => updateLine(line.id, { quantity: e.target.value })} />
            </label>
            <label className="min-w-[100px] flex-1 space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Unit Price</span>
              <input className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:border-primary"
                type="number" min="0" step="0.001" value={line.unitPrice} onChange={(e) => updateLine(line.id, { unitPrice: e.target.value })} />
            </label>
            <label className="min-w-[100px] flex-1 space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Total</span>
              <input className="h-9 w-full rounded-md border bg-background px-2 text-sm font-mono outline-none focus:border-primary"
                type="text" readOnly value={line.totalPrice ? Number(line.totalPrice).toFixed(3) : ""} />
            </label>
            <button className="mb-0.5 flex size-9 items-center justify-center rounded-md border text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
              type="button" onClick={() => removeLine(line.id)} disabled={lines.length === 1}>
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>

      <button className="mt-3 inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition hover:bg-muted"
        type="button" onClick={() => setLines((current) => [...current, createLine()])}>
        <Plus className="size-4" />Add Line
      </button>

      <div className="mt-4 flex flex-wrap gap-3">
        <label className="space-y-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Discount Type</span>
          <select className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:border-primary"
            value={discountType} onChange={(e) => { setDiscountType(e.target.value as "" | "PERCENTAGE" | "FIXED"); setDiscountRate(""); }}>
            <option value="">None</option>
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED">Fixed</option>
          </select>
        </label>
        {discountType ? (
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">{discountType === "PERCENTAGE" ? "Rate (%)" : "Amount"}</span>
            <input className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:border-primary"
              type="number" min="0" step="any" value={discountRate} onChange={(e) => setDiscountRate(e.target.value)} />
          </label>
        ) : null}
      </div>
    </section>
  );
}
