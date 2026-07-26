import { ArrowLeft, Download, FileText, Printer, XCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { getQuotationAction } from "@/domains/quotations/actions/get-quotation";
import { statusColorClass, formatStatus } from "@/components/status-colors";
import { QuotationActions } from "./quotation-actions";
import { QuotationMarkSent } from "./quotation-mark-sent";

const statusIcon: Record<string, React.ReactNode> = {
  DRAFT: <FileText className="size-4" />,
  SENT: <FileText className="size-4" />,
  EXPIRED: <XCircle className="size-4" />,
  CANCELLED: <XCircle className="size-4" />,
};

export async function generateMetadata({ params }: { params: Promise<{ qtId: string }> }): Promise<Metadata> {
  const { qtId } = await params;
  const quotation = await getQuotationAction(qtId);
  if (!quotation) return { title: "Not Found" };
  return { title: quotation.qtNumber };
}

export default async function QuotationDetailPage({ params }: { params: Promise<{ qtId: string }> }) {
  const { qtId } = await params;
  const quotation = await getQuotationAction(qtId);

  if (!quotation) notFound();

  const isDraft = quotation.status === "DRAFT";
  const isSent = quotation.status === "SENT";
  const isCancelled = quotation.status === "CANCELLED";
  const isExpired = quotation.status === "EXPIRED";
  const showActions = isDraft || isSent;

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <div className="flex items-start justify-between">
            <div>
              <Link href="/quotations" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-3" />
                Back to Quotations
              </Link>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-normal">{quotation.qtNumber}</h1>
                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-medium ${statusColorClass(quotation.status)}`}>
                  {statusIcon[quotation.status]}
                  {formatStatus(quotation.status)}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {quotation.customer.name} &middot; Issued {new Date(quotation.issueDate).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Link
                  href={`/quotations/${qtId}/print`}
                  target="_blank"
                  className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition hover:bg-muted"
                >
                  <Printer className="size-4" />
                  Print
                </Link>
                <a
                  href={`/api/v1/quotations/${qtId}/pdf`}
                  target="_blank"
                  className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition hover:bg-muted"
                >
                  <Download className="size-4" />
                  Download PDF
                </a>
              </div>
              {isDraft ? (
                <Link
                  href={`/quotations/${qtId}/edit`}
                  className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition hover:bg-muted"
                >
                  Edit
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <section className="rounded-lg border p-5">
              <h2 className="text-sm font-semibold">Line Items</h2>
              <div className="mt-3 overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
                    <tr className="border-b">
                      <th className="h-10 px-3 text-left">Barcode</th>
                      <th className="h-10 px-3 text-left">Product</th>
                      <th className="h-10 px-3 text-center">UOM</th>
                      <th className="h-10 px-3 text-center leading-tight">PC/CTN<br /><span className="font-normal">الوحدات / كرتون</span></th>
                      <th className="h-10 px-3 text-right">Qty</th>
                      <th className="h-10 px-3 text-right">Unit Price</th>
                      <th className="h-10 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotation.lines.map((line) => (
                      <tr key={line.id} className="border-b last:border-b-0 hover:bg-muted/30">
                        <td className="h-10 px-3 font-mono text-xs text-muted-foreground">{line.productBarcode ?? "—"}</td>
                        <td className="h-10 px-3">
                          <span className="font-medium">{line.productName}</span>
                          {line.productArabicName ? <span className="ml-2 text-xs text-muted-foreground">{line.productArabicName}</span> : null}
                        </td>
                        <td className="h-10 px-3 text-center text-xs text-muted-foreground">{line.unitOfMeasureCode}</td>
                        <td className="h-10 px-3 text-center font-mono tabular-nums text-muted-foreground">{line.piecesPerBox ? Number(line.piecesPerBox).toFixed(0) : "—"}</td>
                        <td className="h-10 px-3 text-right font-mono tabular-nums">{Number(line.quantity).toFixed(3)}</td>
                        <td className="h-10 px-3 text-right font-mono tabular-nums">{Number(line.unitPrice).toFixed(3)}</td>
                        <td className="h-10 px-3 text-right font-mono tabular-nums font-semibold">{Number(line.totalPrice).toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-lg border p-5">
              <h2 className="text-sm font-semibold">Summary</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="font-mono tabular-nums">{Number(quotation.subtotal).toFixed(3)}</dd>
                </div>
                {Number(quotation.discountAmount) > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Discount</dt>
                    <dd className="font-mono tabular-nums">{Number(quotation.discountAmount).toFixed(3)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Tax</dt>
                  <dd className="font-mono tabular-nums">{Number(quotation.taxAmount).toFixed(3)}</dd>
                </div>
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <dt>Total</dt>
                  <dd className="font-mono tabular-nums">{Number(quotation.totalAmount).toFixed(3)}</dd>
                </div>
                <div className="flex justify-between pt-2">
                  <dt className="text-muted-foreground">Currency</dt>
                  <dd>{quotation.currency}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-lg border p-5">
              <h2 className="text-sm font-semibold">Details</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Issued</dt>
                  <dd>{new Date(quotation.issueDate).toLocaleDateString()}</dd>
                </div>
                {quotation.validUntil ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Valid until</dt>
                    <dd>{new Date(quotation.validUntil).toLocaleDateString()}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Created by</dt>
                  <dd>{quotation.createdBy?.name ?? "Unknown"}</dd>
                </div>
                {quotation.cancelledBy ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Cancelled by</dt>
                    <dd>{quotation.cancelledBy.name}</dd>
                  </div>
                ) : null}
                {quotation.cancelledAt ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Cancelled at</dt>
                    <dd>{new Date(quotation.cancelledAt).toLocaleString()}</dd>
                  </div>
                ) : null}
              </dl>
            </section>

            {quotation.notes ? (
              <section className="rounded-lg border p-5">
                <h2 className="text-sm font-semibold">Notes</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{quotation.notes}</p>
              </section>
            ) : null}

            {quotation.terms ? (
              <section className="rounded-lg border p-5">
                <h2 className="text-sm font-semibold">Terms</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{quotation.terms}</p>
              </section>
            ) : null}

            {showActions ? (
              <section className="rounded-lg border p-5">
                <h2 className="text-sm font-semibold">Actions</h2>
                <div className="mt-3 space-y-2">
                  {isDraft ? <QuotationMarkSent qtId={qtId} /> : null}
                  {!isCancelled ? <QuotationActions qtId={qtId} /> : null}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
