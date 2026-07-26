"use server";

import { prisma } from "@/infrastructure/database/prisma";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

export async function getQuotationAction(id: string) {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();

  const quotation = await prisma.quotation.findFirst({
    where: { id, organizationId: context.organizationId },
    include: {
      customer: true,
      createdBy: { select: { id: true, name: true } },
      cancelledBy: { select: { id: true, name: true } },
      lines: {
        orderBy: { lineNumber: "asc" },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          unitOfMeasure: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });

  return quotation;
}
