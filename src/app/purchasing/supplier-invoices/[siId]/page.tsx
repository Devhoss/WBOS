import { ArrowLeft, CheckCircle, Send, XCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { AttachmentService } from "@/domains/attachments/services/attachment-service";
import { SupplierInvoiceRepository } from "@/domains/supplier-invoices/repositories/supplier-invoice-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { statusColorClass, formatStatus } from "@/components/status-colors";
import { getEntityTimeline } from "@/app/entity-timeline";
import { DocumentTimeline } from "@/app/document-timeline";
import { AttachmentSection } from "../attachment-section";
import { SupplierInvoiceActions } from "../supplier-invoice-actions";
import { SupplierPaymentForm } from "../supplier-payment-form";

export async function generateMetadata({ params }: { params: Promise<{ siId: string }> }): Promise<Metadata> {
  const { siId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const invoice = await new SupplierInvoiceRepository().findById(context.organizationId, siId);

  if (!invoice) return { title: "Not Found" };
  return { title: invoice.siNumber };
}

export default async function SupplierInvoiceDetailPage({
  params,
}: {
  params: Promise<{ siId: string }>;
}) {
  const { siId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();

  const [invoice, attachments] = await Promise.all([
    new SupplierInvoiceRepository().findById(context.organizationId, siId),
    new AttachmentService().list(context, "SupplierInvoice", siId),
  ]);

  if (!invoice) {
    notFound();
  }

  const timeline = await getEntityTimeline(context.organizationId, "SupplierInvoice", invoice.id);

  const statusIcon: Record<string, React.ReactNode> = {
    DRAFT: <Send className="size-4" />,
    ISSUED: <CheckCircle className="size-4" />,
    PARTIALLY_PAID: <CheckCircle className="size-4" />,
    PAID: <CheckCircle className="size-4" />,
    CANCELLED: <XCircle className="size-4" />,
  };

  const totalAmount = Number(invoice.totalAmount);
  const amountPaid = Number(invoice.amountPaid);
  const balance = totalAmount - amountPaid;
  const canRecordPayment = ["ISSUED", "PARTIALLY_PAID"].includes(invoice.status);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <div className="flex items-start justify-between">
            <div>
              <Link
                href="/purchasing/supplier-invoices"
                className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-3" />
                Back to Supplier Invoices
              </Link>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-normal">{invoice.siNumber}</h1>
                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-medium ${statusColorClass(invoice.status)}`}>
                  {statusIcon[invoice.status]}
                  {formatStatus(invoice.status)}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {invoice.supplier.name}
                {invoice.reference ? <span className="ml-2 text-xs"> · Ref {invoice.reference}</span> : null}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {canRecordPayment ? (
              <SupplierPaymentForm
                invoiceId={invoice.id}
                currency={invoice.currency}
                totalAmount={totalAmount}
                amountPaid={amountPaid}
              />
            ) : null}

            {invoice.payments.length > 0 ? (
              <section className="rounded-lg border p-5">
                <h2 className="text-sm font-semibold">Payment History</h2>
                <div className="mt-3 overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
                      <tr className="border-b">
                        <th className="h-10 px-3 text-left">Payment #</th>
                        <th className="h-10 px-3 text-left">Method</th>
                        <th className="h-10 px-3 text-left">Reference</th>
                        <th className="h-10 px-3 text-right">Amount</th>
                        <th className="h-10 px-3 text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.payments.map((p) => (
                        <tr key={p.id} className="border-b last:border-b-0 hover:bg-muted/30">
                          <td className="h-10 px-3 font-mono text-xs font-medium">{p.paymentNumber}</td>
                          <td className="h-10 px-3 capitalize">{p.method.toLowerCase()}</td>
                          <td className="h-10 px-3 text-muted-foreground">{p.reference ?? "-"}</td>
                          <td className="h-10 px-3 text-right font-mono tabular-nums">{Number(p.amount).toFixed(3)}</td>
                          <td className="h-10 px-3 text-right text-muted-foreground">{new Date(p.paidAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            <AttachmentSection
              entityType="SupplierInvoice"
              entityId={invoice.id}
              attachments={attachments.map((att) => ({
                id: att.id,
                fileName: att.fileName,
                mimeType: att.mimeType,
                sizeBytes: att.sizeBytes,
                url: att.url,
                uploadedByName: att.uploadedBy?.name ?? null,
                createdAt: att.createdAt.toISOString(),
              }))}
            />
          </div>

          <div className="space-y-6">
            <section className="rounded-lg border p-5">
              <h2 className="text-sm font-semibold">Financial Summary</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-mono tabular-nums">{Number(invoice.subtotal).toFixed(3)}</dd></div>
                {Number(invoice.taxAmount) > 0 ? (
                  <div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd className="font-mono tabular-nums">{Number(invoice.taxAmount).toFixed(3)}</dd></div>
                ) : null}
                <div className="flex justify-between border-t pt-2"><dt className="font-semibold">Total</dt><dd className="font-mono tabular-nums font-bold">{totalAmount.toFixed(3)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Paid</dt><dd className="font-mono tabular-nums text-emerald-600">{amountPaid.toFixed(3)}</dd></div>
                <div className="flex justify-between border-t pt-2">
                  <dt className="font-semibold">Balance</dt>
                  <dd className={`font-mono tabular-nums font-bold ${balance > 0 ? "text-amber-600" : "text-emerald-600"}`}>{balance.toFixed(3)}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-lg border p-5">
              <h2 className="text-sm font-semibold">Details</h2>
              <dl className="mt-3 space-y-3 text-sm">
                <div><dt className="text-xs text-muted-foreground">Supplier</dt><dd className="font-medium">{invoice.supplier.name}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Currency</dt><dd>{invoice.currency}</dd></div>
                {invoice.reference ? <div><dt className="text-xs text-muted-foreground">Supplier Reference</dt><dd>{invoice.reference}</dd></div> : null}
                {invoice.dueDate ? <div><dt className="text-xs text-muted-foreground">Due Date</dt><dd>{new Date(invoice.dueDate).toLocaleDateString()}</dd></div> : null}
                {invoice.issuedAt ? <div><dt className="text-xs text-muted-foreground">Issued</dt><dd>{new Date(invoice.issuedAt).toLocaleDateString()}</dd></div> : null}
                {invoice.paidAt ? <div><dt className="text-xs text-muted-foreground">Paid</dt><dd>{new Date(invoice.paidAt).toLocaleDateString()}</dd></div> : null}
                <div><dt className="text-xs text-muted-foreground">Created by</dt><dd>{invoice.createdBy?.name ?? invoice.createdBy?.email ?? "Unknown"}</dd></div>
                {invoice.notes ? <div><dt className="text-xs text-muted-foreground">Notes</dt><dd className="mt-1 text-xs">{invoice.notes}</dd></div> : null}
              </dl>
            </section>

            {!invoice.archivedAt ? (
              <section className="rounded-lg border p-5">
                <h2 className="text-sm font-semibold">Actions</h2>
                <div className="mt-3 space-y-2">
                  <SupplierInvoiceActions
                    siId={invoice.id}
                    status={invoice.status}
                    archivedAt={null}
                  />
                </div>
              </section>
            ) : null}

            <DocumentTimeline entries={timeline} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}