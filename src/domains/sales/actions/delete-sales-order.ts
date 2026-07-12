"use server";

import { z } from "zod";
import { prisma } from "@/infrastructure/database/prisma";
import { revalidatePath } from "next/cache";

import { requireMinimumRole } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

const deleteSchema = z.object({ id: z.string().min(1) });

export async function deleteSalesOrder(input: unknown) {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid input." };

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    requireMinimumRole(context, "ADMIN");

    const order = await prisma.salesOrder.findFirst({
      where: { id: parsed.data.id, organizationId: context.organizationId },
      select: { id: true, soNumber: true, status: true },
    });

    if (!order) throw new BusinessError("Sales order was not found.", "SALES_ORDER_NOT_FOUND");
    if (order.status !== "DRAFT" && order.status !== "PENDING_APPROVAL") {
      throw new BusinessError("Only draft or pending approval orders can be deleted.", "SALES_CANNOT_DELETE");
    }

    await prisma.$transaction([
      prisma.salesOrderLine.deleteMany({ where: { salesOrderId: order.id } }),
      prisma.salesOrder.delete({ where: { id: order.id } }),
    ]);

    revalidatePath("/sales/orders");
    return { ok: true };
  } catch (error) {
    if (error instanceof BusinessError) return { ok: false, message: error.message };
    throw error;
  }
}
