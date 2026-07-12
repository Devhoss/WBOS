"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { ShipmentService } from "../services/shipment-service";

const schema = z.object({
  id: z.string().trim().min(1),
  status: z.enum(["PICKING", "PICKED", "LOADED", "OUT_FOR_DELIVERY", "FAILED"]),
});

export async function updateShipmentStatusAction(input: unknown) {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid request.",
    };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();

    if (!new Set(["OWNER", "ADMIN", "MANAGER", "WAREHOUSE"]).has(context.role)) {
      throw new BusinessError("You do not have permission to update shipments.", "FORBIDDEN");
    }

    await new ShipmentService().updateStatus(context, parsed.data.id, parsed.data.status);
    revalidatePath("/sales");
    revalidatePath("/sales/shipments");
    revalidatePath("/sales/orders");

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
