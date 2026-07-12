import { ArrowLeft, Calendar, Hash, Info, Package, User } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { statusColorClass, formatStatus } from "@/components/status-colors";
import { CycleCountRepository } from "@/domains/inventory/repositories/cycle-count-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { CountLinesTable } from "./count-lines-table";
import { CountActions } from "./count-actions";

export async function generateMetadata({ params }: { params: Promise<{ countId: string }> }): Promise<Metadata> {
  const { countId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const count = await new CycleCountRepository().findById(context.organizationId, countId);

  if (!count) return { title: "Not Found" };
  return { title: count.countNumber };
}

export default async function CycleCountDetailPage({ params }: { params: Promise<{ countId: string }> }) {
  const { countId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const count = await new CycleCountRepository().findById(context.organizationId, countId);

  if (!count) notFound();

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <Link
            href="/inventory/cycle-counts"
            className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" /> Back to Cycle Counts
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-normal">{count.countNumber}</h1>
                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-medium ${statusColorClass(count.status)}`}>
                  {formatStatus(count.status)}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{count.warehouse.name}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <CountLinesTable
              status={count.status}
              lines={count.lines.map((l) => ({
                id: l.id,
                productName: l.product.name,
                productSku: l.product.sku,
                productBarcode: l.product.barcode,
                expectedQty: Number(l.expectedQty),
                countedQty: l.countedQty !== null ? Number(l.countedQty) : null,
                variance: l.variance !== null ? Number(l.variance) : null,
                notes: l.notes,
              }))}
            />
          </div>

          <div className="space-y-6">
            <section className="rounded-lg border p-5">
              <h2 className="text-sm font-semibold">Details</h2>
              <dl className="mt-3 space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <Hash className="size-4 text-muted-foreground" />
                  <dt className="text-muted-foreground">Number</dt>
                  <dd className="ml-auto font-medium">{count.countNumber}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <Info className="size-4 text-muted-foreground" />
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="ml-auto">{formatStatus(count.status)}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <Package className="size-4 text-muted-foreground" />
                  <dt className="text-muted-foreground">Warehouse</dt>
                  <dd className="ml-auto">{count.warehouse.name}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <User className="size-4 text-muted-foreground" />
                  <dt className="text-muted-foreground">Counted by</dt>
                  <dd className="ml-auto">{count.countedBy?.name ?? "Unknown"}</dd>
                </div>
                {count.countedAt ? (
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-muted-foreground" />
                    <dt className="text-muted-foreground">Counted at</dt>
                    <dd className="ml-auto">{new Date(count.countedAt).toLocaleString()}</dd>
                  </div>
                ) : null}
                {count.approvedBy ? (
                  <div className="flex items-center gap-2">
                    <User className="size-4 text-muted-foreground" />
                    <dt className="text-muted-foreground">Approved by</dt>
                    <dd className="ml-auto">{count.approvedBy.name}</dd>
                  </div>
                ) : null}
                {count.approvedAt ? (
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-muted-foreground" />
                    <dt className="text-muted-foreground">Approved at</dt>
                    <dd className="ml-auto">{new Date(count.approvedAt).toLocaleString()}</dd>
                  </div>
                ) : null}
                {count.notes ? (
                  <div className="pt-2 text-xs text-muted-foreground">{count.notes}</div>
                ) : null}
              </dl>
            </section>

            <CountActions countId={count.id} status={count.status} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
