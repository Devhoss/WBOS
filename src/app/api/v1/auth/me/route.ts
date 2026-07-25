import { NextRequest, NextResponse } from "next/server";

import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { prisma } from "@/infrastructure/database/prisma";

export async function GET(req: NextRequest) {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext(req.headers);

    const warehouses = await prisma.warehouse.findMany({
      where: { organizationId: context.organizationId, archivedAt: null },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      id: context.user.id,
      email: context.user.email,
      name: context.user.name,
      image: context.user.image ?? null,
      role: context.role,
      organizationId: context.organizationId,
      organizationName: context.organization.name,
      membershipId: context.membership.id,
      warehouses,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
