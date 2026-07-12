"use client";

import { Ruler } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { ActionMenu } from "@/components/action-menu";
import { activateUnitOfMeasure } from "@/domains/units/actions/activate-unit-of-measure";
import { archiveUnitOfMeasure } from "@/domains/units/actions/archive-unit-of-measure";
import { deleteUnitOfMeasure } from "@/domains/units/actions/delete-unit-of-measure";

import { UnitOfMeasureForm, type UnitFormValue } from "./unit-of-measure-form";

type UnitRow = {
  id: string; name: string; code: string; description: string;
  isBaseUnit: boolean; conversionToBase: string; archived: boolean;
};

function toFormValue(u: UnitRow): UnitFormValue {
  return {
    id: u.id, name: u.name, code: u.code, description: u.description,
    isBaseUnit: u.isBaseUnit, conversionToBase: u.conversionToBase,
  };
}

export function UnitTable({ units, archived }: {
  units: UnitRow[]; archived: UnitRow[];
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const editingUnit = [...units, ...archived].find((u) => u.id === editingId) ?? null;

  async function runAction(action: () => Promise<{ ok: boolean; message?: string }>, msg: string) {
    setFeedback("");
    const result = await action();
    setFeedback(result.ok ? msg : result.message ?? "Unable to update unit.");
    if (result.ok) router.refresh();
  }

  if (units.length === 0 && archived.length === 0) {
    return (
      <section className="rounded-lg border px-6 py-12 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Ruler className="size-6" />
        </div>
        <h2 className="mt-4 text-base font-semibold">No units yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Create your first unit of measure to define how products are counted.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border">
      {feedback ? <div className="border-b bg-muted/40 px-4 py-3 text-sm text-muted-foreground" role="status">{feedback}</div> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[650px] text-sm">
          <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
            <tr className="border-b">
              <th className="h-11 px-4 text-left">Name</th><th className="h-11 px-4 text-left">Code</th>
              <th className="h-11 px-4 text-left">Conversion</th><th className="h-11 px-4 text-left">Status</th>
              <th className="h-11 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.id} className="h-14 border-b transition last:border-b-0 odd:bg-muted/20 hover:bg-muted/50">
                <td className="px-4 font-medium">
                  {u.name}
                  {u.description ? <span className="ml-2 text-xs text-muted-foreground">{u.description}</span> : null}
                </td>
                <td className="px-4 text-muted-foreground">{u.code}</td>
                <td className="px-4 text-muted-foreground">{u.conversionToBase}</td>
                <td className="px-4 text-muted-foreground">{u.isBaseUnit ? "Base" : "Active"}</td>
                <td className="px-4 text-right">
                  <ActionMenu items={[
                    { label: "Edit", onClick: () => setEditingId(u.id) },
                    { label: "Archive", onClick: () => void runAction(() => archiveUnitOfMeasure({ id: u.id }), "Unit archived.") },
                    { label: "Delete", variant: "destructive", onClick: () => { if (window.confirm(`Delete ${u.name}? This cannot be undone if the unit has no related products.`)) void runAction(() => deleteUnitOfMeasure({ id: u.id }), "Unit deleted."); } },
                  ]} />
                </td>
              </tr>
            ))}
            {archived.length > 0 ? (
              <tr className="border-b bg-muted/30">
                <td className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground" colSpan={5}>Archived ({archived.length})</td>
              </tr>
            ) : null}
            {archived.map((u) => (
              <tr key={u.id} className="h-14 border-b transition last:border-b-0 odd:bg-muted/20 hover:bg-muted/50 text-muted-foreground">
                <td className="px-4 font-medium">{u.name}</td>
                <td className="px-4">{u.code}</td>
                <td className="px-4">{u.conversionToBase}</td>
                <td className="px-4">Archived</td>
                <td className="px-4 text-right">
                  <ActionMenu items={[
                    { label: "Edit", onClick: () => setEditingId(u.id) },
                    { label: "Activate", onClick: () => void runAction(() => activateUnitOfMeasure({ id: u.id }), "Unit activated.") },
                    { label: "Delete", variant: "destructive", onClick: () => { if (window.confirm(`Delete ${u.name}? This cannot be undone if the unit has no related products.`)) void runAction(() => deleteUnitOfMeasure({ id: u.id }), "Unit deleted."); } },
                  ]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editingUnit ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-background shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-base font-semibold">Edit Unit</h2>
              <button className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted" type="button" onClick={() => setEditingId(null)}>Close</button>
            </div>
            <div className="p-5">
              <UnitOfMeasureForm unit={toFormValue(editingUnit)} onSuccess={() => setEditingId(null)} />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
