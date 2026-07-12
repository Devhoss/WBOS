import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/infrastructure/database/prisma";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

export async function GET(req: NextRequest) {
  const { organizationId } = await new AuthenticatedRequestContextService().getCurrentContext(req.headers);

  const customers = await prisma.customer.findMany({
    where: { organizationId, archivedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(customers);
}
