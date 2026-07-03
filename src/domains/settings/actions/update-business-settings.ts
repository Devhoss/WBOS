"use server";

import { revalidatePath } from "next/cache";

import { requireMinimumRole } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { BusinessSettingsService } from "../services/business-settings-service";
import { updateBusinessSettingsSchema } from "../validation/business-settings-schema";

export async function updateBusinessSettings(input: unknown) {
  const parsed = updateBusinessSettingsSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid business settings.",
    };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    requireMinimumRole(context, "MANAGER");

    await new BusinessSettingsService().updateForContext(context, parsed.data);
    revalidatePath("/settings");

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
