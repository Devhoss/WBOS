/* eslint-disable @typescript-eslint/no-explicit-any */
import { ArrowLeft, CheckCircle, Clock, FileText, Truck, XCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { TaskDomainService } from "@/domains/tasks/services/task-domain-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { statusColorClass, formatStatus } from "@/components/status-colors";
import { getEntityTimeline } from "@/app/entity-timeline";
import { DocumentTimeline } from "@/app/document-timeline";

import { TaskDetailActions } from "./task-detail-actions";
import { RescheduleTaskForm } from "./reschedule-task-form";
import { canManage } from "@/infrastructure/authorization/rbac";
const typeLabels: Record<string, string> = {
  PICK_ORDER: "Pick Order",
  GOODS_RECEIPT: "Goods Receipt",
  CYCLE_COUNT: "Cycle Count",
  INVENTORY_TRANSFER: "Inventory Transfer",
  DELIVERY: "Delivery",
};

const statusIcon: Record<string, React.ReactNode> = {
  READY: <Clock className="size-4" />,
  IN_PROGRESS: <Truck className="size-4" />,
  COMPLETED: <CheckCircle className="size-4" />,
  CANCELLED: <XCircle className="size-4" />,
};

export async function generateMetadata({ params }: { params: Promise<{ taskId: string }> }): Promise<Metadata> {
  const { taskId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const task = await new TaskDomainService().findById(context.organizationId, taskId, new Date());
  if (!task) return { title: "Not Found" };
  return { title: task.taskNumber };
}

export default async function TaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const domain = new TaskDomainService();
  const task = await domain.findById(context.organizationId, taskId, new Date());
  if (!task) notFound();

  const timeline = await getEntityTimeline(context.organizationId, "Task", taskId);

  const shipmentId = task.metadata?.shipmentId as string | undefined;
  if (shipmentId) {
    const shipmentTimeline = await getEntityTimeline(context.organizationId, "Shipment", shipmentId);
    timeline.push(...shipmentTimeline);
    timeline.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  const canStart = task.status === "READY";
  const canComplete = task.status === "IN_PROGRESS";
  const canCancel = task.status !== "COMPLETED" && task.status !== "CANCELLED";
  const canReschedule =
    canManage(context.role) &&
    (task.status === "SCHEDULED" || task.status === "READY");

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <div className="flex items-start justify-between">
            <div>
              <Link href="/tasks" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-3" />
                Back to Tasks
              </Link>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-normal">{task.taskNumber}</h1>
                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-medium ${statusColorClass(task.status)}`}>
                  {statusIcon[task.status]}
                  {formatStatus(task.status)}
                </span>
                {task.priority === "HIGH" || task.priority === "URGENT" ? (
                  <span className={`text-xs font-medium ${task.priority === "URGENT" ? "text-red-500" : "text-amber-500"}`}>
                    {task.priority}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {typeLabels[task.type] ?? task.type} &middot; {task.warehouseName}
                {task.assignedTo ? <> &middot; Assigned to {task.assignedTo.name}</> : null}
              </p>
              {task.subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{task.subtitle}</p> : null}
            </div>
            {(canStart || canComplete || canCancel) ? (
              <TaskDetailActions taskId={taskId} status={task.status} updatedAt={task.updatedAt.toISOString()} />
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <section className="rounded-lg border p-5">
              <h2 className="text-sm font-semibold">Lines</h2>
              <div className="mt-3 overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
                    <tr className="border-b">
                      <th className="h-10 px-3 text-left">#</th>
                      <th className="h-10 px-3 text-left">Product</th>
                      <th className="h-10 px-3 text-right">Ordered</th>
                      <th className="h-10 px-3 text-right">Picked</th>
                      <th className="h-10 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {task.lines.map((line) => (
                      <tr key={line.id} className="border-b last:border-b-0 hover:bg-muted/30">
                        <td className="h-10 px-3 text-muted-foreground">{line.sortOrder}</td>
                        <td className="h-10 px-3">
                          <span className="font-medium">{line.productName || <span className="italic text-muted-foreground">Product #{line.productId}</span>}</span>
                          {line.productSku ? <span className="ml-2 font-mono text-xs text-muted-foreground">{line.productSku}</span> : null}
                          {line.barcode ? <span className="ml-2 font-mono text-[10px] text-muted-foreground">[{line.barcode}]</span> : null}
                        </td>
                        <td className="h-10 px-3 text-right font-mono tabular-nums">{Number(line.quantityOrdered).toFixed(3)}</td>
                        <td className="h-10 px-3 text-right font-mono tabular-nums">{Number(line.completedQuantity).toFixed(3)}</td>
                        <td className="h-10 px-3 text-right">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColorClass(line.status)}`}>
                            {formatStatus(line.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {task.lines.length === 0 ? (
                      <tr><td colSpan={5} className="h-20 text-center text-sm text-muted-foreground">No lines</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            {task.reference ? (
              <section className="rounded-lg border p-5">
                <h2 className="text-sm font-semibold">Reference</h2>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-3 rounded-md border p-3 text-sm">
                    <FileText className="size-4 text-muted-foreground shrink-0" />
                    <div className="grow">
                      {task.referenceType === "SALES_ORDER" ? (
                        <>
                          <Link href={`/sales/orders/${task.referenceId}`} className="font-medium hover:underline">
                            {String((task.reference as any)?.soNumber ?? task.referenceId)}
                          </Link>
                          <span className="ml-2 text-muted-foreground">
                            {(task.reference as any)?.customerName ?? ""}
                          </span>
                        </>
                      ) : (
                        <span className="font-medium">{String(task.referenceId)}</span>
                      )}
                    </div>
                    {(task.reference as any)?.shipmentNumber ? (
                      <span className="text-xs text-muted-foreground">
                        Shipment {(task.reference as any).shipmentNumber}
                      </span>
                    ) : null}
                    {(task.reference as any)?.shipmentStatus ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColorClass(String((task.reference as any).shipmentStatus))}`}>
                        {formatStatus(String((task.reference as any).shipmentStatus))}
                      </span>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}
          </div>

          <div className="space-y-6">
            <section className="rounded-lg border p-5">
              <h2 className="text-sm font-semibold">Details</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Type</dt>
                  <dd>{typeLabels[task.type] ?? task.type}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Priority</dt>
                  <dd>{task.priority}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Warehouse</dt>
                  <dd>{task.warehouseName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Assigned to</dt>
                  <dd>{task.assignedTo?.name ?? "Unassigned"}</dd>
                </div>
                {task.dueAt ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Due</dt>
                    <dd>{new Date(task.dueAt).toLocaleDateString()}</dd>
                  </div>
                ) : null}
                {task.startedAt ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Started</dt>
                    <dd>{new Date(task.startedAt).toLocaleString()}</dd>
                  </div>
                ) : null}
                {task.completedAt ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Completed</dt>
                    <dd>{new Date(task.completedAt).toLocaleString()}</dd>
                  </div>
                ) : null}
                {task.cancelledAt ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Cancelled</dt>
                    <dd>{new Date(task.cancelledAt).toLocaleString()}</dd>
                  </div>
                ) : null}
                {task.cancelledReason ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Reason</dt>
                    <dd className="text-right text-xs">{task.cancelledReason}</dd>
                  </div>
                ) : null}
              </dl>
            </section>

            {canReschedule ? (
              <RescheduleTaskForm
                taskId={taskId}
                dueAt={task.dueAt?.toISOString() ?? null}
                updatedAt={task.updatedAt.toISOString()}
              />
            ) : null}

            <DocumentTimeline entries={timeline} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
