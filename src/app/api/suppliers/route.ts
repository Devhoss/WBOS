import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/infrastructure/database/prisma";
import { apiContext } from "@/infrastructure/request/api-context";

export async function GET(req: NextRequest) {
  const auth = await apiContext(req.headers);
  if (!auth.ok) return auth.response;
  const { organizationId } = auth.context;

  const suppliers = await prisma.supplier.findMany({
    where: { organizationId, archivedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(suppliers);
}
