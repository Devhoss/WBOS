"use client";

import { Warehouse } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { ActionMenu } from "@/components/action-menu";
import { activateWarehouse } from "@/domains/warehouses/actions/activate-warehouse";
import { archiveWarehouse } from "@/domains/warehouses/actions/archive-warehouse";
import { deleteWarehouse } from "@/domains/warehouses/actions/delete-warehouse";

import { WarehouseForm, type WarehouseFormValue } from "./warehouse-form";

type WarehouseRow = {
  id: string; name: string; code: string; address: string; isDefault: boolean; archived: boolean;
};

function toFormValue(w: WarehouseRow): WarehouseFormValue {
  return { id: w.id, name: w.name, code: w.code, address: w.address, isDefault: w.isDefault };
}

export function WarehouseTable({ warehouses, archived }: {
  warehouses: WarehouseRow[]; archived: WarehouseRow[];
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const editingWarehouse = [...warehouses, ...archived].find((w) => w.id === editingId) ?? null;

  async function runAction(action: () => Promise<{ ok: boolean; message?: string }>, msg: string) {
    setFeedback("");
    const result = await action();
    setFeedback(result.ok ? msg : result.message ?? "Unable to update warehouse.");
    if (result.ok) router.refresh();
  }

  if (warehouses.length === 0 && archived.length === 0) {
    return (
      <section className="rounded-lg border px-6 py-12 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Warehouse className="size-6" />
        </div>
        <h2 className="mt-4 text-base font-semibold">No warehouses yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Create your first warehouse to enable inventory workflows.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border">
      {feedback ? <div className="border-b bg-muted/40 px-4 py-3 text-sm text-muted-foreground" role="status">{feedback}</div> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
            <tr className="border-b">
              <th className="h-11 px-4 text-left">Name</th><th className="h-11 px-4 text-left">Code</th>
              <th className="h-11 px-4 text-left">Status</th><th className="h-11 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {warehouses.map((w) => (
              <tr key={w.id} className="h-14 border-b transition last:border-b-0 odd:bg-muted/20 hover:bg-muted/50">
                <td className="px-4 font-medium">
                  {w.name}
                  {w.address ? <span className="ml-2 text-xs text-muted-foreground">{w.address}</span> : null}
                </td>
                <td className="px-4 text-muted-foreground">{w.code}</td>
                <td className="px-4 text-muted-foreground">{w.isDefault ? "Default" : "Active"}</td>
                <td className="px-4 text-right">
                  <ActionMenu items={[
                    { label: "Edit", onClick: () => setEditingId(w.id) },
                    { label: "Archive", onClick: () => void runAction(() => archiveWarehouse({ id: w.id }), "Warehouse archived.") },
                    { label: "Delete", variant: "destructive", onClick: () => { if (window.confirm(`Delete ${w.name}? This cannot be undone if the warehouse has no related stock.`)) void runAction(() => deleteWarehouse({ id: w.id }), "Warehouse deleted."); } },
                  ]} />
                </td>
              </tr>
            ))}
            {archived.length > 0 ? (
              <tr className="border-b bg-muted/30">
                <td className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground" colSpan={4}>Archived ({archived.length})</td>
              </tr>
            ) : null}
            {archived.map((w) => (
              <tr key={w.id} className="h-14 border-b transition last:border-b-0 odd:bg-muted/20 hover:bg-muted/50 text-muted-foreground">
                <td className="px-4 font-medium">{w.name}</td>
                <td className="px-4">{w.code}</td>
                <td className="px-4">{w.isDefault ? "Default" : "Archived"}</td>
                <td className="px-4 text-right">
                  <ActionMenu items={[
                    { label: "Edit", onClick: () => setEditingId(w.id) },
                    { label: "Activate", onClick: () => void runAction(() => activateWarehouse({ id: w.id }), "Warehouse activated.") },
                    { label: "Delete", variant: "destructive", onClick: () => { if (window.confirm(`Delete ${w.name}? This cannot be undone if the warehouse has no related stock.`)) void runAction(() => deleteWarehouse({ id: w.id }), "Warehouse deleted."); } },
                  ]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editingWarehouse ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-background shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-base font-semibold">Edit Warehouse</h2>
              <button className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted" type="button" onClick={() => setEditingId(null)}>Close</button>
            </div>
            <div className="p-5">
              <WarehouseForm warehouse={toFormValue(editingWarehouse)} onSuccess={() => setEditingId(null)} />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
