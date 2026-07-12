"use server";

import { revalidatePath } from "next/cache";

import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { ShipmentService } from "../services/shipment-service";
import { shipmentStatusActionSchema } from "../validation/shipment-schema";

const allowedRoles = new Set(["OWNER", "ADMIN", "MANAGER", "WAREHOUSE"]);

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

    if (!allowedRoles.has(context.role)) {
      throw new BusinessError("You do not have permission to confirm delivery.", "FORBIDDEN");
    }

    await new ShipmentService().deliver(context, parsed.data.id);
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
