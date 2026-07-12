"use server";

import { revalidatePath } from "next/cache";

import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { ShipmentService } from "../services/shipment-service";
import { createShipmentSchema } from "../validation/shipment-schema";

const allowedRoles = new Set(["OWNER", "ADMIN", "MANAGER", "WAREHOUSE"]);

export async function createShipmentAction(input: unknown) {
  const parsed = createShipmentSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid shipment.",
    };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();

    if (!allowedRoles.has(context.role)) {
      throw new BusinessError("You do not have permission to create shipments.", "FORBIDDEN");
    }

    const shipment = await new ShipmentService().create(context, parsed.data);
    revalidatePath("/sales");
    revalidatePath("/sales/shipments");
    revalidatePath("/sales/orders");

    return { ok: true, data: { id: shipment.id } };
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
