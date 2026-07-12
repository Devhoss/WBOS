"use server";

import { revalidatePath } from "next/cache";

import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { ShipmentService } from "../services/shipment-service";

const allowedRoles = new Set(["OWNER", "ADMIN", "MANAGER", "WAREHOUSE"]);

export async function manualPickAction(input: { shipmentId: string; lineId: string; quantity: number }) {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();

    if (!allowedRoles.has(context.role)) {
      throw new BusinessError("You do not have permission to pick items.", "FORBIDDEN");
    }

    await new ShipmentService().addPickQuantity(context, input.shipmentId, input.lineId, input.quantity);

    revalidatePath("/sales/shipments");

    return { ok: true };
  } catch (error) {
    if (error instanceof BusinessError) {
      return { ok: false, message: error.message };
    }

    throw error;
  }
}
