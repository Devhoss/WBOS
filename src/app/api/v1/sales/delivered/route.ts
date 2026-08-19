import { NextRequest, NextResponse } from "next/server";

import { apiContext } from "@/infrastructure/request/api-context";
import { prisma } from "@/infrastructure/database/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await apiContext(req.headers);
    if (!auth.ok) return auth.response;
    const context = auth.context;
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
