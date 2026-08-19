import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/infrastructure/database/prisma";
import { ShipmentRepository } from "@/domains/sales/repositories/shipment-repository";
import { requireManager } from "@/infrastructure/authorization/rbac";
import { apiContext } from "@/infrastructure/request/api-context";
import { accountRateLimitOrNull } from "@/infrastructure/rate-limit/enforce";
import { BusinessError } from "@/shared/errors/business-error";

const shipments = new ShipmentRepository();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await apiContext(req.headers);
    if (!auth.ok) return auth.response;
    const context = auth.context;
    // Parity with the server action path, which has always guarded this.
    requireManager(context);
    const { id } = await params;

    const limited = accountRateLimitOrNull(context.userId, "shipment-warehouse-notes");
    if (limited) return limited;

    const body = await req.json();
    const warehouseNotes = typeof body.warehouseNotes === "string" ? body.warehouseNotes : null;

    const shipment = await shipments.findById(context.organizationId, id);
    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    await prisma.shipment.update({
      where: { id },
      data: { warehouseNotes },
    });

    return NextResponse.json({ ok: true, warehouseNotes });
  } catch (error) {
    if (error instanceof BusinessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
