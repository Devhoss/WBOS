/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { TaskRepository } from "@/domains/tasks/repositories/task-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { TaskTable } from "./task-table";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage(props: { searchParams?: Promise<{ status?: string; type?: string }> }) {
  const searchParams = await props.searchParams;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();

  const result = await new TaskRepository().findMany(context.organizationId, {
    pageSize: 50,
    status: searchParams?.status as any,
    type: searchParams?.type,
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">Tasks</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Warehouse tasks across all workflows. Tasks represent units of work assigned to users.
              </p>
            </div>
          </div>
        </div>

        <TaskTable
          tasks={result.data.map((t) => ({
            id: t.id,
            taskNumber: t.taskNumber,
            type: t.type,
            status: t.status,
            priority: t.priority,
            title: t.title,
            subtitle: t.subtitle ?? "",
            warehouseName: t.warehouse?.name ?? "",
            assignedToName: t.assignedTo?.name ?? "",
            createdAt: t.createdAt.toISOString(),
          }))}
          total={result.total}
        />
      </div>
    </AppShell>
  );
}
