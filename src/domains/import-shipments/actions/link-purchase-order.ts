"use server";

import { revalidatePath } from "next/cache";

import { requireMinimumRole } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { ImportShipmentService } from "../services/import-shipment-service";
import { linkPurchaseOrderSchema } from "../validation/import-shipment-schema";

export async function linkPurchaseOrder(input: unknown) {
  const parsed = linkPurchaseOrderSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid purchase order link." };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    requireMinimumRole(context, "MANAGER");

    const shipment = await new ImportShipmentService().linkPurchaseOrder(context, parsed.data);

    revalidatePath("/purchasing");
    revalidatePath("/purchasing/import-shipments");
    revalidatePath(`/purchasing/import-shipments/${shipment.id}`);

    return { ok: true } as const;
  } catch (error) {
    if (error instanceof BusinessError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function unlinkPurchaseOrder(input: unknown) {
  const parsed = linkPurchaseOrderSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Invalid purchase order link." };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    requireMinimumRole(context, "MANAGER");

    const shipment = await new ImportShipmentService().unlinkPurchaseOrder(context, parsed.data);

    revalidatePath("/purchasing");
    revalidatePath("/purchasing/import-shipments");
    revalidatePath(`/purchasing/import-shipments/${shipment.id}`);

    return { ok: true } as const;
  } catch (error) {
    if (error instanceof BusinessError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}