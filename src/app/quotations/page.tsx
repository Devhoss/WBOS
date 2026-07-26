import { FileText, Plus } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { listQuotationsAction } from "@/domains/quotations/actions/list-quotations";
import { statusColorClass, formatStatus } from "@/components/status-colors";

export const metadata: Metadata = { title: "Quotations" };

export default async function QuotationsPage() {
  const quotations = await listQuotationsAction();

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">Quotations</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Commercial documents sent to customers for pricing.
            </p>
          </div>
          <Link
            href="/quotations/new"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            <Plus className="size-4" />
            New Quotation
          </Link>
        </div>

        {quotations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border py-16 text-sm text-muted-foreground">
            <FileText className="size-8" />
            <p>No quotations yet.</p>
            <Link href="/quotations/new" className="text-primary hover:underline">Create your first quotation</Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
                <tr className="border-b">
                  <th className="h-11 px-4 text-left">Number</th>
                  <th className="h-11 px-4 text-left">Customer</th>
                  <th className="h-11 px-4 text-left">Status</th>
                  <th className="h-11 px-4 text-right">Total</th>
                  <th className="h-11 px-4 text-left">Created</th>
                  <th className="h-11 px-4 text-left">Valid Until</th>
                  <th className="h-11 px-4 text-left">Created By</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map((q) => (
                  <tr key={q.id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="h-11 px-4">
                      <Link href={`/quotations/${q.id}`} className="font-medium text-primary hover:underline">
                        {q.qtNumber}
                      </Link>
                    </td>
                    <td className="h-11 px-4">{q.customerName}</td>
                    <td className="h-11 px-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColorClass(q.status)}`}>
                        {formatStatus(q.status)}
                      </span>
                    </td>
                    <td className="h-11 px-4 text-right font-mono tabular-nums">{q.totalAmount.toFixed(3)}</td>
                    <td className="h-11 px-4">{new Date(q.issueDate).toLocaleDateString()}</td>
                    <td className="h-11 px-4">{q.validUntil ? new Date(q.validUntil).toLocaleDateString() : "-"}</td>
                    <td className="h-11 px-4 text-muted-foreground">{q.createdByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
