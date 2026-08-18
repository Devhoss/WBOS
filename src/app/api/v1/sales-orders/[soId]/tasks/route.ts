/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";

import { SalesOrderRepository } from "@/domains/sales/repositories/sales-order-repository";
import { ShipmentRepository } from "@/domains/sales/repositories/shipment-repository";
import { TaskDomainService } from "@/domains/tasks/services/task-domain-service";
import { requireManager } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

const domain = new TaskDomainService();
const orders = new SalesOrderRepository();
const shipmentsRepo = new ShipmentRepository();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ soId: string }> },
) {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext(req.headers);
    const { soId } = await params;
    const body = await req.json().catch(() => ({}));

    requireManager(context);

    const order = await orders.findById(context.organizationId, soId);
    if (!order) {
      return NextResponse.json({ error: "Sales order not found" }, { status: 404 });
    }
    if (order.status !== "APPROVED" && order.status !== "READY_FOR_INVOICE" && order.status !== "INVOICED") {
      return NextResponse.json(
        { error: "Pick tasks can only be created for approved sales orders." },
        { status: 400 },
      );
    }

    const activeShipments = await shipmentsRepo.listWithFilters(context.organizationId, {
      salesOrderId: soId,
      status: body.shipmentStatus ?? "PENDING_PICK" as any,
    });

    const shipments = activeShipments.data.filter(
      (s) => s.status === "PENDING_PICK" || s.status === "PICKING",
    );

    if (shipments.length === 0) {
      return NextResponse.json(
        { error: "No active shipments found for this sales order." },
        { status: 400 },
      );
    }

    const tasks = [];
    for (const shipment of shipments) {
      const shipmentDetail = await shipmentsRepo.findById(context.organizationId, shipment.id);
      if (!shipmentDetail) continue;
      const task = await domain.createFromShipment(context, shipmentDetail as any);
      tasks.push(task);
    }

    return NextResponse.json({ tasks }, { status: 201 });
  } catch (error) {
    if (error instanceof BusinessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
