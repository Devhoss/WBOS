"use server";

import { prisma } from "@/infrastructure/database/prisma";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

export async function listQuotationsAction() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();

  const quotations = await prisma.quotation.findMany({
    where: { organizationId: context.organizationId },
    include: {
      customer: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      lines: { select: { id: true } },
      _count: { select: { lines: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return quotations.map((q) => ({
    id: q.id,
    qtNumber: q.qtNumber,
    customerName: q.customer.name,
    status: q.status,
    totalAmount: Number(q.totalAmount),
    lineCount: q._count.lines,
    createdByName: q.createdBy.name,
    issueDate: q.issueDate,
    validUntil: q.validUntil,
    createdAt: q.createdAt,
  }));
}
