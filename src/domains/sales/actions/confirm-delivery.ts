"use server";

import { revalidatePath } from "next/cache";

import { requireManager } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";
import { createNotificationService } from "@/domains/notifications/services/create-notification-service";
import { ShipmentRepository } from "@/domains/sales/repositories/shipment-repository";

import { ShipmentService } from "../services/shipment-service";
import { shipmentStatusActionSchema } from "../validation/shipment-schema";

export async function confirmDeliveryAction(input: unknown) {
  const parsed = shipmentStatusActionSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid request.",
    };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();

    requireManager(context);

    await new ShipmentService().deliver(context, parsed.data.id);

    const shipment = await new ShipmentRepository().findById(context.organizationId, parsed.data.id);
    if (shipment) {
      await createNotificationService().notifyDeliveryCompleted(
        { organizationId: context.organizationId, userId: context.userId },
        { shipmentNumber: shipment.shipmentNumber, soNumber: shipment.salesOrder?.soNumber, link: shipment.id },
      );
    }

    revalidatePath("/sales");
    revalidatePath("/sales/shipments");
    revalidatePath("/sales/orders");
    revalidatePath("/inventory");

    return { ok: true };
  } catch (error) {
    if (error instanceof BusinessError) {
      return {
        ok: false,
        message: error.message,
      };
    }

    throw error;
  }
}
