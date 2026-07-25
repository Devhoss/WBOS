import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { CreditNoteService } from "@/domains/credit-notes/services/credit-note-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { getEntityTimeline } from "@/app/entity-timeline";
import { DocumentTimeline } from "@/app/document-timeline";

export async function generateMetadata({ params }: { params: Promise<{ creditNoteId: string }> }): Promise<Metadata> {
  const { creditNoteId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const cn = await new CreditNoteService().findById(context.organizationId, creditNoteId);
  if (!cn) return { title: "Not Found" };
  return { title: cn.creditNoteNumber };
}

export default async function CreditNoteDetailPage({ params }: { params: Promise<{ creditNoteId: string }> }) {
  const { creditNoteId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const creditNote = await new CreditNoteService().findById(context.organizationId, creditNoteId);
  if (!creditNote) notFound();

  const timeline = await getEntityTimeline(context.organizationId, "CreditNote", creditNote.id);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="border-b pb-6">
          <div className="flex items-start justify-between">
            <div>
              <Link href="/credit-notes" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-3.5" /> Back to Credit Notes
              </Link>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-normal">{creditNote.creditNoteNumber}</h1>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  creditNote.status === "ISSUED" ? "bg-green-100 text-green-800" :
                  creditNote.status === "CANCELLED" ? "bg-red-100 text-red-600" :
                  "bg-gray-100 text-gray-600"
                }`}>
                  {creditNote.status}
                </span>
              </div>
            </div>
            {["ISSUED"].includes(creditNote.status) ? (
              <Link
                href={`/credit-notes/${creditNote.id}/print`}
                target="_blank"
                className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition hover:bg-muted"
              >
                <ExternalLink className="size-4" />
                Print View
              </Link>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Customer</p>
            <p className="text-sm font-medium">{creditNote.customer.name}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Invoice</p>
            <Link href={`/invoices/${creditNote.invoice.id}`} className="text-sm font-medium text-primary hover:underline">
              {creditNote.invoice.invoiceNumber}
            </Link>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Issued</p>
            <p className="text-sm font-medium">
              {creditNote.issuedAt ? new Date(creditNote.issuedAt).toLocaleDateString() : new Date(creditNote.createdAt).toLocaleDateString()}
              {creditNote.createdBy ? <> by {creditNote.createdBy.name}</> : null}
            </p>
          </div>

          {creditNote.returnOrder && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Return</p>
              <Link href={`/returns/${creditNote.returnOrder.id}`} className="text-sm font-medium text-primary hover:underline">
                {creditNote.returnOrder.returnNumber}
              </Link>
            </div>
          )}

          {creditNote.reason ? (
            <div className="col-span-3 space-y-1">
              <p className="text-sm text-muted-foreground">Reason</p>
              <p className="text-sm">{creditNote.reason}</p>
            </div>
          ) : null}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Items ({creditNote.lines.length} line{creditNote.lines.length !== 1 ? "s" : ""})
          </h2>
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">#</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Product</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Qty</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Unit Price</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {creditNote.lines.map((line) => (
                  <tr key={line.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5 text-muted-foreground">{line.lineNumber}</td>
                    <td className="px-4 py-2.5 font-medium">
                      {line.productName || line.productId}
                      {line.productSku ? <span className="ml-2 font-mono text-xs text-muted-foreground">{line.productSku}</span> : null}
                    </td>
                    <td className="px-4 py-2.5 text-right">{Number(line.quantity).toFixed(3)} {line.unitOfMeasureCode}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{Number(line.unitPrice).toFixed(3)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium">{Number(line.totalPrice).toFixed(3)}</td>
                  </tr>
                ))}
                <tr className="border-t bg-muted/30 font-medium">
                  <td colSpan={4} className="px-4 py-2.5 text-right">Total</td>
                  <td className="px-4 py-2.5 text-right font-mono">{Number(creditNote.totalAmount).toFixed(3)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="no-print">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Timeline</h2>
          <DocumentTimeline entries={timeline} />
        </div>
      </div>
    </AppShell>
  );
}
