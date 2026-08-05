"use client";

import { Link2, Unlink } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { linkLandedCost, linkSupplierInvoice } from "@/domains/import-shipments/actions/link-supplier-invoice";
import { linkPurchaseOrder, unlinkPurchaseOrder } from "@/domains/import-shipments/actions/link-purchase-order";
import { HelpTooltip } from "@/components/help-tooltip";

type Option = {
  id: string;
  label: string;
};

type PurchaseOrderLink = {
  id: string;
  poNumber: string;
  status: string;
  supplierName: string;
  totalAmount: string;
};

type SupplierInvoiceLink = {
  id: string;
  siNumber: string;
  status: string;
  supplierName: string;
  totalAmount: string;
  amountPaid: string;
};

type LandedCostLink = {
  id: string;
  lcNumber: string;
  status: string;
  supplierName: string;
};

export function ImportShipmentLinks({
  shipmentId,
  purchaseOrderLinks,
  supplierInvoice,
  landedCost,
  purchaseOrderOptions,
  supplierInvoiceOptions,
  landedCostOptions,
}: {
  shipmentId: string;
  purchaseOrderLinks: PurchaseOrderLink[];
  supplierInvoice: SupplierInvoiceLink | null;
  landedCost: LandedCostLink | null;
  purchaseOrderOptions: Option[];
  supplierInvoiceOptions: Option[];
  landedCostOptions: Option[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [po, setPo] = useState("");
  const [si, setSi] = useState("");
  const [lc, setLc] = useState("");
  const [isPending, startTransition] = useTransition();

  async function run(action: Promise<{ ok: boolean; message?: string }>) {
    setMessage(null);
    const result = await action;
    if (!result.ok) { setMessage(result.message ?? "Action failed."); return; }
    router.refresh();
  }

  function submitLinkPo(formData: FormData) {
    startTransition(async () => {
      await run(linkPurchaseOrder({ importShipmentId: shipmentId, purchaseOrderId: String(formData.get("purchaseOrderId")) }));
    });
  }

  function submitLinkSi(formData: FormData) {
    startTransition(async () => {
      await run(linkSupplierInvoice({ importShipmentId: shipmentId, supplierInvoiceId: String(formData.get("supplierInvoiceId")) }));
    });
  }

  function submitLinkLc(formData: FormData) {
    startTransition(async () => {
      await run(linkLandedCost({ importShipmentId: shipmentId, landedCostId: String(formData.get("landedCostId")) }));
    });
  }

  function unlinkPo(purchaseOrderId: string) {
    if (!window.confirm("Unlink this purchase order?")) return;
    startTransition(async () => {
      await run(unlinkPurchaseOrder({ importShipmentId: shipmentId, purchaseOrderId }));
    });
  }

  return (
    <div className="space-y-6">
      {message ? <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-400" role="alert">{message}</p> : null}

      <section className="rounded-lg border p-5">
        <h2 className="text-sm font-semibold">Purchase Orders</h2>
        {purchaseOrderLinks.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {purchaseOrderLinks.map((link) => (
              <li key={link.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <a href={`/purchasing/orders/${link.id}`} className="font-mono text-xs font-medium text-primary hover:underline">{link.poNumber}</a>
                  <p className="text-xs text-muted-foreground">
                    {link.supplierName} · {link.status.replace(/_/g, " ")} · {Number(link.totalAmount).toFixed(3)}
                  </p>
                </div>
                <button className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-2 text-xs text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950" disabled={isPending} type="button" onClick={() => unlinkPo(link.id)}>
                  <Unlink className="size-3.5" />Unlink
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">No purchase orders linked.</p>
        )}
        <form action={submitLinkPo} className="mt-3 flex flex-wrap items-center gap-2">
          <select className="h-9 flex-1 rounded-md border bg-background px-2 text-sm outline-none focus:border-primary" name="purchaseOrderId" value={po} onChange={(e) => setPo(e.target.value)} required>
            <option value="" disabled>Select a purchase order...</option>
            {purchaseOrderOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          <button className="inline-flex h-9 items-center gap-1 rounded-md border px-3 text-sm font-medium transition hover:bg-muted disabled:opacity-60" disabled={isPending || purchaseOrderOptions.length === 0} type="submit">
            <Link2 className="size-3.5" />Link
          </button>
        </form>
      </section>

      <section className="rounded-lg border p-5">
        <h2 className="text-sm font-semibold">Supplier Invoice</h2>
        {supplierInvoice ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
            <div className="min-w-0">
              <a href={`/purchasing/supplier-invoices/${supplierInvoice.id}`} className="font-mono text-xs font-medium text-primary hover:underline">{supplierInvoice.siNumber}</a>
              <p className="text-xs text-muted-foreground">
                {supplierInvoice.supplierName} · {supplierInvoice.status.replace(/_/g, " ")} · {Number(supplierInvoice.amountPaid).toFixed(3)} / {Number(supplierInvoice.totalAmount).toFixed(3)}
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-3 text-xs text-muted-foreground">No supplier invoice linked.</p>
            <form action={submitLinkSi} className="mt-3 flex flex-wrap items-center gap-2">
              <select className="h-9 flex-1 rounded-md border bg-background px-2 text-sm outline-none focus:border-primary" name="supplierInvoiceId" value={si} onChange={(e) => setSi(e.target.value)} required>
                <option value="" disabled>Select a supplier invoice...</option>
                {supplierInvoiceOptions.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
              <button className="inline-flex h-9 items-center gap-1 rounded-md border px-3 text-sm font-medium transition hover:bg-muted disabled:opacity-60" disabled={isPending || supplierInvoiceOptions.length === 0} type="submit">
                <Link2 className="size-3.5" />Link
              </button>
            </form>
          </>
        )}
      </section>

      <section className="rounded-lg border p-5">
        <h2 className="flex items-center gap-1 text-sm font-semibold">
          Landed Cost
          <HelpTooltip term="landedCost" />
        </h2>
        {landedCost ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
            <div className="min-w-0">
              <a href={`/purchasing/landed-costs/${landedCost.id}`} className="font-mono text-xs font-medium text-primary hover:underline">{landedCost.lcNumber}</a>
              <p className="text-xs text-muted-foreground">
                {landedCost.supplierName} · {landedCost.status.replace(/_/g, " ")}
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-3 text-xs text-muted-foreground">No landed cost linked.</p>
            <form action={submitLinkLc} className="mt-3 flex flex-wrap items-center gap-2">
              <select className="h-9 flex-1 rounded-md border bg-background px-2 text-sm outline-none focus:border-primary" name="landedCostId" value={lc} onChange={(e) => setLc(e.target.value)} required>
                <option value="" disabled>Select a landed cost...</option>
                {landedCostOptions.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
              <button className="inline-flex h-9 items-center gap-1 rounded-md border px-3 text-sm font-medium transition hover:bg-muted disabled:opacity-60" disabled={isPending || landedCostOptions.length === 0} type="submit">
                <Link2 className="size-3.5" />Link
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}