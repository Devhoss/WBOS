"use server";

import { revalidatePath } from "next/cache";

import { requireManager } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { ImportShipmentService } from "../services/import-shipment-service";
import { linkLandedCostSchema, linkSupplierInvoiceSchema } from "../validation/import-shipment-schema";

export async function linkSupplierInvoice(input: unknown) {
  const parsed = linkSupplierInvoiceSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Invalid supplier invoice link." };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    requireManager(context);

    const shipment = await new ImportShipmentService().linkSupplierInvoice(context, parsed.data);

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

export async function linkLandedCost(input: unknown) {
  const parsed = linkLandedCostSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Invalid landed cost link." };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    requireManager(context);

    const shipment = await new ImportShipmentService().linkLandedCost(context, parsed.data);

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