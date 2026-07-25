/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";

import { TaskApplicationService } from "@/domains/tasks/services/task-application-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

const app = new TaskApplicationService();

export async function GET(req: NextRequest) {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext(req.headers);
    const { searchParams } = new URL(req.url);

    const statusParam = searchParams.get("status");
    const filters = {
      type: searchParams.get("type") ?? undefined,
      status: statusParam ? (statusParam as any) : undefined,
      assignedToId: searchParams.get("assignedTo") === "me" ? context.userId : (searchParams.get("assignedTo") ?? undefined),
      warehouseId: searchParams.get("warehouseId") ?? undefined,
      filter: searchParams.get("filter") as "today" | "scheduled" | undefined,
      page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
      pageSize: searchParams.get("pageSize") ? Number(searchParams.get("pageSize")) : undefined,
    };

    const result = await app.listTasks(context, filters as any);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof BusinessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
