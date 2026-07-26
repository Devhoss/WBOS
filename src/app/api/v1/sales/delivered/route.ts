import { NextRequest, NextResponse } from "next/server";

import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { prisma } from "@/infrastructure/database/prisma";

export async function GET(req: NextRequest) {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext(req.headers);

    const orders = await prisma.salesOrder.findMany({
      where: {
        organizationId: context.organizationId,
        archivedAt: null,
        shipments: { some: { status: "DELIVERED" } },
      },
      orderBy: { orderedAt: "desc" },
      take: 50,
      select: {
        id: true,
        soNumber: true,
        orderedAt: true,
        signedInvoicePath: true,
        customer: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data: orders });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
