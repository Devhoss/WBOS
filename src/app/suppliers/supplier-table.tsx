"use client";

import { Package } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { ActionMenu } from "@/components/action-menu";
import { activateSupplier } from "@/domains/suppliers/actions/activate-supplier";
import { archiveSupplier } from "@/domains/suppliers/actions/archive-supplier";
import { deleteSupplier } from "@/domains/suppliers/actions/delete-supplier";

import { SupplierForm, type SupplierFormValue } from "./supplier-form";

type SupplierRow = {
  id: string; name: string; code: string; email: string; contactName: string;
  phone: string; paymentTerms: string; leadTimeDays: number | null;
  address: string; notes: string; archived: boolean;
};

function toFormValue(s: SupplierRow): SupplierFormValue {
  return {
    id: s.id, name: s.name, code: s.code, contactName: s.contactName, email: s.email,
    phone: s.phone, address: s.address, paymentTerms: s.paymentTerms,
    leadTimeDays: s.leadTimeDays?.toString() ?? "", notes: s.notes,
  };
}

export function SupplierTable({ suppliers, archived }: { suppliers: SupplierRow[]; archived: SupplierRow[] }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const editingSupplier = [...suppliers, ...archived].find((s) => s.id === editingId) ?? null;

  async function runAction(action: () => Promise<{ ok: boolean; message?: string }>, msg: string) {
    setFeedback("");
    const result = await action();
    setFeedback(result.ok ? msg : result.message ?? "Unable to update supplier.");
    if (result.ok) router.refresh();
  }

  if (suppliers.length === 0 && archived.length === 0) {
    return (
      <section className="rounded-lg border px-6 py-12 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Package className="size-6" />
        </div>
        <h2 className="mt-4 text-base font-semibold">No suppliers yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Add your first supplier to start building your supply chain.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border">
      {feedback ? <div className="border-b bg-muted/40 px-4 py-3 text-sm text-muted-foreground" role="status">{feedback}</div> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
            <tr className="border-b">
              <th className="h-11 px-4 text-left">Name</th><th className="h-11 px-4 text-left">Code</th>
              <th className="h-11 px-4 text-left">Contact</th><th className="h-11 px-4 text-left">Email</th>
              <th className="h-11 px-4 text-right">Lead Time</th><th className="h-11 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} className="h-14 border-b transition last:border-b-0 odd:bg-muted/20 hover:bg-muted/50">
                <td className="px-4 font-medium">{s.name}</td>
                <td className="px-4 text-muted-foreground">{s.code || "-"}</td>
                <td className="px-4 text-muted-foreground">{s.contactName || s.phone || "-"}</td>
                <td className="px-4 text-muted-foreground">{s.email || "-"}</td>
                <td className="px-4 text-right text-muted-foreground">{s.leadTimeDays === null ? "-" : `${s.leadTimeDays}d`}</td>
                <td className="px-4 text-right">
                  <ActionMenu items={[
                    { label: "Edit", onClick: () => setEditingId(s.id) },
                    { label: "Archive", onClick: () => void runAction(() => archiveSupplier({ id: s.id }), "Supplier archived.") },
                    { label: "Delete", variant: "destructive", onClick: () => { if (window.confirm(`Delete ${s.name}? This cannot be undone if the supplier has no related records.`)) void runAction(() => deleteSupplier({ id: s.id }), "Supplier deleted."); } },
                  ]} />
                </td>
              </tr>
            ))}
            {archived.length > 0 ? (
              <tr className="border-b bg-muted/30">
                <td className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground" colSpan={6}>Archived ({archived.length})</td>
              </tr>
            ) : null}
            {archived.map((s) => (
              <tr key={s.id} className="h-14 border-b transition last:border-b-0 odd:bg-muted/20 hover:bg-muted/50 text-muted-foreground">
                <td className="px-4 font-medium">{s.name}</td>
                <td className="px-4">{s.code || "-"}</td>
                <td className="px-4">{s.contactName || s.phone || "-"}</td>
                <td className="px-4">{s.email || "-"}</td>
                <td className="px-4 text-right">{s.leadTimeDays === null ? "-" : `${s.leadTimeDays}d`}</td>
                <td className="px-4 text-right">
                  <ActionMenu items={[
                    { label: "Edit", onClick: () => setEditingId(s.id) },
                    { label: "Activate", onClick: () => void runAction(() => activateSupplier({ id: s.id }), "Supplier activated.") },
                    { label: "Delete", variant: "destructive", onClick: () => { if (window.confirm(`Delete ${s.name}? This cannot be undone if the supplier has no related records.`)) void runAction(() => deleteSupplier({ id: s.id }), "Supplier deleted."); } },
                  ]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editingSupplier ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-background shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-base font-semibold">Edit Supplier</h2>
              <button className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted" type="button" onClick={() => setEditingId(null)}>Close</button>
            </div>
            <div className="p-5">
              <SupplierForm supplier={toFormValue(editingSupplier)} onSuccess={() => setEditingId(null)} />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
