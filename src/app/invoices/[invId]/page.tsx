import { ArrowLeft, ExternalLink, Truck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { InvoiceRepository } from "@/domains/sales/repositories/invoice-repository";
import { BusinessSettingsRepository } from "@/domains/settings/repositories/business-settings-repository";
import { CustomerBalanceService } from "@/domains/sales/services/customer-balance-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { prisma } from "@/infrastructure/database/prisma";

import { statusColorClass, formatStatus } from "@/components/status-colors";
import { getEntityTimeline } from "@/app/entity-timeline";
import { DocumentTimeline } from "@/app/document-timeline";
import { PrintableInvoice } from "@/components/invoice/printable-invoice";

export async function generateMetadata({ params }: { params: Promise<{ invId: string }> }): Promise<Metadata> {
  const { invId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const invoice = await new InvoiceRepository().findById(context.organizationId, invId);

  if (!invoice) return { title: "Not Found" };
  return { title: invoice.invoiceNumber };
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ invId: string }> }) {
  const { invId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();

  const [invoice, settings] = await Promise.all([
    new InvoiceRepository().findById(context.organizationId, invId),
    new BusinessSettingsRepository().findByOrganizationId(context.organizationId),
  ]);

  if (!invoice || !settings) notFound();

  const customerBalance = await new CustomerBalanceService().getBalanceSummary(
    context.organizationId,
    invoice.customer.id,
  );

  const latestShipment = await prisma.shipment.findFirst({
    where: {
      organizationId: context.organizationId,
      salesOrderId: invoice.salesOrderId,
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, shipmentNumber: true, status: true },
  });

  const deliveryStatusFromShipment: Record<string, string> = {
    PENDING_PICK: "Pending Pick",
    PICKING: "Picking",
    PICKED: "Picked",
    LOADED: "Loaded",
    OUT_FOR_DELIVERY: "Out for Delivery",
    DELIVERED: "Delivered",
    FAILED: "Failed",
  };

  const liveDeliveryStatus = latestShipment
    ? deliveryStatusFromShipment[latestShipment.status] ?? null
    : null;

  const timeline = await getEntityTimeline(context.organizationId, "Invoice", invoice.id);

  const canRecordPayment = ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status);

  const branding = {
    businessName: settings.businessName,
    arabicBusinessName: settings.arabicBusinessName,
    address: settings.address,
    phone: settings.phone,
    email: settings.email,
    website: settings.website,
    vatNumber: settings.vatNumber,
    commercialRegistration: settings.commercialRegistration,
    logoPath: settings.logoPath,
    footer: settings.footer,
    termsAndConditions: settings.termsAndConditions,
    documentLanguage: settings.documentLanguage,
  };

  const invoiceData = {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    currency: invoice.currency,
    subtotal: Number(invoice.subtotal),
    taxAmount: Number(invoice.taxAmount),
    discountAmount: Number(invoice.discountAmount),
    discountType: invoice.discountType,
    discountRate: invoice.discountRate ? Number(invoice.discountRate) : null,
    totalAmount: Number(invoice.totalAmount),
    amountPaid: Number(invoice.amountPaid),
    issuedAt: invoice.issuedAt?.toISOString() ?? null,
    dueDate: invoice.dueDate?.toISOString() ?? null,
    customerName: invoice.customerName,
    customerAddress: invoice.customerAddress,
    paymentTerms: invoice.paymentTerms,
    notes: invoice.notes,
    warehouseName: invoice.warehouseName,
    deliveryStatus: invoice.deliveryStatus,
    liveDeliveryStatus,
    latestShipmentNumber: latestShipment?.shipmentNumber ?? null,
    salesOrder: { soNumber: invoice.salesOrder.soNumber },
    lines: invoice.lines.map((l) => ({
      lineNumber: l.lineNumber,
      productName: l.productName,
      productSku: l.productSku,
      unitOfMeasureCode: l.unitOfMeasureCode,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      discountAmount: 0,
      totalPrice: Number(l.totalPrice),
      piecesPerBox: l.piecesPerBox ? Number(l.piecesPerBox) : null,
    })),
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-4">
            <Link href="/invoices" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-3" />Back
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold">{invoice.invoiceNumber}</h1>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColorClass(invoice.status)}`}>
                  {formatStatus(invoice.status)}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {invoice.customerName} &middot; {invoice.salesOrder.soNumber}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/invoices/${invId}/print`}
              target="_blank"
              className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition hover:bg-muted"
            >
              <ExternalLink className="size-4" />
              Print View
            </Link>
            {canRecordPayment ? (
              <Link
                href={`/payments/new?invoiceId=${invoice.id}`}
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              >
                Record Payment
              </Link>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
              <PrintableInvoice branding={branding} invoice={invoiceData} />
            </div>
            {invoice.payments.length > 0 ? (
              <section className="mt-6 rounded-lg border p-5">
                <h2 className="text-sm font-semibold">Payment History</h2>
                <div className="mt-3 overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
                      <tr className="border-b">
                        <th className="h-10 px-3 text-left">Payment #</th>
                        <th className="h-10 px-3 text-left">Method</th>
                        <th className="h-10 px-3 text-right">Amount</th>
                        <th className="h-10 px-3 text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.payments.map((p) => (
                        <tr key={p.id} className="border-b last:border-b-0 hover:bg-muted/30">
                          <td className="h-10 px-3 font-medium">{p.paymentNumber}</td>
                          <td className="h-10 px-3 capitalize">{p.method.toLowerCase()}</td>
                          <td className="h-10 px-3 text-right font-mono">{Number(p.amount).toFixed(3)}</td>
                          <td className="h-10 px-3 text-right text-muted-foreground">{new Date(p.paidAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
          </div>

          <div className="space-y-6">
            <section className="rounded-lg border p-5">
              <h2 className="text-sm font-semibold">Summary</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-mono">{Number(invoice.subtotal).toFixed(3)}</dd></div>
                {Number(invoice.discountAmount) > 0 ? <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd className="font-mono text-red-600">-{Number(invoice.discountAmount).toFixed(3)}</dd></div> : null}
                {Number(invoice.taxAmount) > 0 ? <div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd className="font-mono">{Number(invoice.taxAmount).toFixed(3)}</dd></div> : null}
                <div className="flex justify-between border-t pt-2"><dt className="font-semibold">Total</dt><dd className="font-mono font-bold">{Number(invoice.totalAmount).toFixed(3)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Paid</dt><dd className="font-mono text-emerald-600">{Number(invoice.amountPaid).toFixed(3)}</dd></div>
                <div className="flex justify-between border-t pt-2"><dt className="font-semibold">Balance</dt><dd className="font-mono font-bold">{(Number(invoice.totalAmount) - Number(invoice.amountPaid)).toFixed(3)}</dd></div>
              </dl>
            </section>

            <section className="rounded-lg border p-5">
              <h2 className="text-sm font-semibold">Customer Account Summary</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Invoiced</dt><dd className="font-mono">{customerBalance.totalInvoiced.toFixed(3)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Paid</dt><dd className="font-mono text-emerald-600">{customerBalance.totalPaid.toFixed(3)}</dd></div>
                <div className="flex justify-between border-t pt-2">
                  <dt className="font-semibold">Customer Outstanding</dt>
                  <dd className={`font-mono font-bold ${customerBalance.outstanding > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                    {customerBalance.outstanding.toFixed(3)}
                  </dd>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <dt>Open invoices</dt>
                  <dd>{customerBalance.openInvoiceCount}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-lg border p-5">
              <h2 className="text-sm font-semibold">Details</h2>
              <dl className="mt-3 space-y-3 text-sm">
                <div><dt className="text-muted-foreground text-xs">Customer</dt><dd className="font-medium">{invoice.customerName}</dd>{invoice.customerAddress ? <dd className="text-xs text-muted-foreground">{invoice.customerAddress}</dd> : null}</div>
                <div><dt className="text-muted-foreground text-xs">Sales Order</dt><dd><Link href={`/sales/orders/${invoice.salesOrderId}`} className="font-medium text-primary hover:underline">{invoice.salesOrder.soNumber}</Link></dd></div>
                <div><dt className="text-muted-foreground text-xs">Currency</dt><dd>{invoice.currency}</dd></div>
                {invoice.paymentTerms ? <div><dt className="text-muted-foreground text-xs">Payment Terms</dt><dd>{invoice.paymentTerms}</dd></div> : null}
                {invoice.dueDate ? <div><dt className="text-muted-foreground text-xs">Due Date</dt><dd>{new Date(invoice.dueDate).toLocaleDateString()}</dd></div> : null}
                {invoice.issuedAt ? <div><dt className="text-muted-foreground text-xs">Issued</dt><dd>{new Date(invoice.issuedAt).toLocaleDateString()}</dd></div> : null}
                {liveDeliveryStatus ? (
                  <>
                    {latestShipment?.shipmentNumber ? (
                      <div>
                        <dt className="text-muted-foreground text-xs">Shipment</dt>
                        <dd className="font-medium">
                          <Link href={`/sales/shipments/${latestShipment.id}`} className="text-primary hover:underline">
                            {latestShipment.shipmentNumber}
                          </Link>
                        </dd>
                      </div>
                    ) : null}
                    <div>
                      <dt className="text-muted-foreground text-xs">Delivery Status</dt>
                      <dd className="inline-flex items-center gap-1.5 font-medium">
                        <Truck className="size-3.5 text-muted-foreground" />
                        {liveDeliveryStatus}
                      </dd>
                    </div>
                  </>
                ) : null}
              </dl>
            </section>

            <section className="rounded-lg border p-5">
              <h2 className="text-sm font-semibold">Actions</h2>
              <div className="mt-3 space-y-2">
                {canRecordPayment ? (
                  <Link href={`/payments/new?invoiceId=${invoice.id}`} className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:opacity-90">
                    Record Payment
                  </Link>
                ) : null}
                <Link
                  href={`/invoices/${invId}/print`}
                  target="_blank"
                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition hover:bg-muted"
                >
                  <ExternalLink className="size-4" />
                  Print / PDF
                </Link>
              </div>
            </section>

            <DocumentTimeline entries={timeline} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
