"use server";

import { prisma } from "@/infrastructure/database/prisma";
import { ActivityLogRepository } from "../repositories/activity-log-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

const repo = new ActivityLogRepository();

export async function getAuditLogs(params: {
  page: number;
  pageSize?: number;
  search?: string;
  action?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();

  return repo.listPaginated({
    organizationId: context.organizationId,
    page: params.page,
    pageSize: params.pageSize ?? 50,
    search: params.search || undefined,
    action: params.action || undefined,
    entityType: params.entityType || undefined,
    dateFrom: params.dateFrom ? new Date(params.dateFrom) : undefined,
    dateTo: params.dateTo ? new Date(params.dateTo) : undefined,
  });
}

export async function getDistinctEntityTypes() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const result = await prisma.activityLog.findMany({
    where: { organizationId: context.organizationId },
    select: { entityType: true },
    distinct: ["entityType"],
    orderBy: { entityType: "asc" },
  });
  return result.map((r) => r.entityType).filter(Boolean);
}
