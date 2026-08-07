import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessCalendar } from "@/lib/business-calendar";
import type { TaskStatus, ShipmentStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext(req.headers);
    const calendar = new BusinessCalendar(context.organization.timezone);
    const todayStart = calendar.startOfTodayUTC();

    const [pickOrderTasks, deliveries, cycleCounts] = await Promise.all([
      prisma.task.findMany({
        where: {
          organizationId: context.organizationId,
          type: "PICK_ORDER",
          status: "COMPLETED" as TaskStatus,
          completedAt: { gte: todayStart },
        },
        include: { lines: true },
        orderBy: { completedAt: "desc" },
        take: 20,
      }),
      prisma.shipment.findMany({
        where: {
          organizationId: context.organizationId,
          status: "DELIVERED" as ShipmentStatus,
          deliveredAt: { gte: todayStart },
        },
        include: {
          salesOrder: {
            select: {
              soNumber: true,
              customer: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { deliveredAt: "desc" },
        take: 20,
      }),
      prisma.cycleCount.findMany({
        where: {
          organizationId: context.organizationId,
          createdAt: { gte: todayStart },
        },
        include: { lines: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    return NextResponse.json({
      data: {
        pickOrderCount: pickOrderTasks.length,
        deliveryCount: deliveries.length,
        cycleCountCount: cycleCounts.length,
        pickOrders: pickOrderTasks.map((task) => ({
          id: task.id,
          orderNumber: task.taskNumber,
          status: task.status,
          priority: task.priority,
          customerName: "",
          lineCount: task.lines.length,
          itemsPicked: task.lines.filter((l) => l.status === "COMPLETED").length,
        })),
        deliveries: deliveries.map((shipment) => ({
          id: shipment.id,
          deliveryNumber: shipment.shipmentNumber,
          status: shipment.status,
          customerName: shipment.salesOrder?.customer?.name ?? "",
          address: null,
        })),
        cycleCounts: cycleCounts.map((cc) => ({
          id: cc.id,
          countNumber: cc.countNumber,
          status: cc.status,
          location: null,
          lineCount: cc.lines.length,
        })),
      },
    });
  } catch (error) {
    console.error("Failed to fetch today work summary:", error);
    return NextResponse.json(
      { error: "Failed to load today work summary" },
      { status: 500 },
    );
  }
}
