"use server";

import { revalidatePath } from "next/cache";

import { requireManager } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { ManualReceiptService } from "../services/manual-receipt-service";
import { manualReceiptSchema } from "../validation/manual-receipt-schema";

export async function createManualReceipt(input: unknown) {
  const parsed = manualReceiptSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid manual receipt.",
    };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();

    requireManager(context);

    await new ManualReceiptService().receive(context, parsed.data);
    revalidatePath("/inventory/receiving");
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
