"use server";

import { revalidatePath } from "next/cache";

import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { ShipmentService } from "../services/shipment-service";

const allowedRoles = new Set(["OWNER", "ADMIN", "MANAGER", "WAREHOUSE"]);

export async function scanPickAction(input: { shipmentId: string; barcode: string }) {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();

    if (!allowedRoles.has(context.role)) {
      throw new BusinessError("You do not have permission to pick items.", "FORBIDDEN");
    }

    const result = await new ShipmentService().scanPick(context, input.shipmentId, input.barcode);

    revalidatePath("/sales/shipments");

    return { ok: true, message: `Picked ${result.productName}` };
  } catch (error) {
    if (error instanceof BusinessError) {
      return { ok: false, message: error.message };
    }

    throw error;
  }
}
