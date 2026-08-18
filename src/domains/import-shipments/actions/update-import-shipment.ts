"use server";

import { revalidatePath } from "next/cache";

import { requireManager } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { ImportShipmentService } from "../services/import-shipment-service";
import { updateImportShipmentSchema, importShipmentIdSchema } from "../validation/import-shipment-schema";

export async function updateImportShipment(input: unknown) {
  const parsed = updateImportShipmentSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid import shipment." };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    requireManager(context);

    const shipment = await new ImportShipmentService().update(context, parsed.data);

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

export async function archiveImportShipment(input: unknown) {
  const parsed = importShipmentIdSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Invalid import shipment." };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    requireManager(context);

    await new ImportShipmentService().archive(context, parsed.data.id);

    revalidatePath("/purchasing");
    revalidatePath("/purchasing/import-shipments");
    revalidatePath(`/purchasing/import-shipments/${parsed.data.id}`);

    return { ok: true } as const;
  } catch (error) {
    if (error instanceof BusinessError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}