"use client";

import { Users } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { ActionMenu } from "@/components/action-menu";
import { activateCustomer } from "@/domains/customers/actions/activate-customer";
import { archiveCustomer } from "@/domains/customers/actions/archive-customer";
import { deleteCustomer } from "@/domains/customers/actions/delete-customer";

import { CustomerForm, type CustomerFormValue } from "./customer-form";

type CustomerRow = {
  id: string; name: string; code: string; contactName: string; email: string;
  phone: string; address: string; paymentTerms: string; creditLimit: string;
  notes: string; archived: boolean; outstanding: number;
};

function toFormValue(c: CustomerRow): CustomerFormValue {
  return {
    id: c.id, name: c.name, code: c.code, contactName: c.contactName,
    email: c.email, phone: c.phone, address: c.address,
    paymentTerms: c.paymentTerms, creditLimit: c.creditLimit, notes: c.notes,
  };
}

export function CustomerTable({ customers, archived }: {
  customers: CustomerRow[]; archived: CustomerRow[];
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const editingCustomer = [...customers, ...archived].find((c) => c.id === editingId) ?? null;

  async function runAction(action: () => Promise<{ ok: boolean; message?: string }>, msg: string) {
    setFeedback("");
    const result = await action();
    setFeedback(result.ok ? msg : result.message ?? "Unable to update customer.");
    if (result.ok) router.refresh();
  }

  if (customers.length === 0 && archived.length === 0) {
    return (
      <section className="rounded-lg border px-6 py-12 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Users className="size-6" />
        </div>
        <h2 className="mt-4 text-base font-semibold">No customers yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Create your first customer to start processing sales orders.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border">
      {feedback ? <div className="border-b bg-muted/40 px-4 py-3 text-sm text-muted-foreground" role="status">{feedback}</div> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
            <tr className="border-b">
              <th className="h-11 px-4 text-left">Name</th><th className="h-11 px-4 text-left">Code</th>
              <th className="h-11 px-4 text-left">Contact</th><th className="h-11 px-4 text-right">Credit Limit</th>
              <th className="h-11 px-4 text-right">Outstanding</th>
              <th className="h-11 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="h-14 border-b transition last:border-b-0 odd:bg-muted/20 hover:bg-muted/50">
                <td className="px-4 font-medium">
                  <Link href={`/customers/${c.id}`} className="hover:text-primary hover:underline">
                    {c.name}
                  </Link>
                  {c.email ? <span className="ml-2 text-xs text-muted-foreground">{c.email}</span> : null}
                </td>
                <td className="px-4 text-muted-foreground">{c.code || "-"}</td>
                <td className="px-4 text-muted-foreground">{c.contactName || c.phone || "-"}</td>
                <td className="px-4 text-right text-muted-foreground">{c.creditLimit ? `${Number(c.creditLimit).toLocaleString()} KWD` : "-"}</td>
                <td className={`px-4 text-right font-mono tabular-nums text-sm ${c.outstanding > 0 ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                  {c.outstanding > 0 ? c.outstanding.toFixed(3) : "-"}
                </td>
                <td className="px-4 text-right">
                  <ActionMenu items={[
                    { label: "Edit", onClick: () => setEditingId(c.id) },
                    { label: "Archive", onClick: () => void runAction(() => archiveCustomer({ id: c.id }), "Customer archived.") },
                    { label: "Delete", variant: "destructive", onClick: () => { if (window.confirm(`Delete ${c.name}? This cannot be undone if the customer has no related orders.`)) void runAction(() => deleteCustomer({ id: c.id }), "Customer deleted."); } },
                  ]} />
                </td>
              </tr>
            ))}
            {archived.length > 0 ? (
              <tr className="border-b bg-muted/30">
                <td className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground" colSpan={6}>Archived ({archived.length})</td>
              </tr>
            ) : null}
            {archived.map((c) => (
              <tr key={c.id} className="h-14 border-b transition last:border-b-0 odd:bg-muted/20 hover:bg-muted/50 text-muted-foreground">
                <td className="px-4 font-medium">
                  <Link href={`/customers/${c.id}`} className="hover:text-primary hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4">{c.code || "-"}</td>
                <td className="px-4">{c.contactName || c.phone || "-"}</td>
                <td className="px-4 text-right">{c.creditLimit ? `${Number(c.creditLimit).toLocaleString()} KWD` : "-"}</td>
                <td className={`px-4 text-right font-mono tabular-nums text-sm ${c.outstanding > 0 ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                  {c.outstanding > 0 ? c.outstanding.toFixed(3) : "-"}
                </td>
                <td className="px-4 text-right">
                  <ActionMenu items={[
                    { label: "Edit", onClick: () => setEditingId(c.id) },
                    { label: "Activate", onClick: () => void runAction(() => activateCustomer({ id: c.id }), "Customer activated.") },
                    { label: "Delete", variant: "destructive", onClick: () => { if (window.confirm(`Delete ${c.name}? This cannot be undone if the customer has no related orders.`)) void runAction(() => deleteCustomer({ id: c.id }), "Customer deleted."); } },
                  ]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editingCustomer ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-background shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-base font-semibold">Edit Customer</h2>
              <button className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted" type="button" onClick={() => setEditingId(null)}>Close</button>
            </div>
            <div className="p-5">
              <CustomerForm customer={toFormValue(editingCustomer)} onSuccess={() => setEditingId(null)} />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
