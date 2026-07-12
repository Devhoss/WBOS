"use server";

import { revalidatePath } from "next/cache";

import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { ManualReceiptService } from "../services/manual-receipt-service";
import { manualReceiptSchema } from "../validation/manual-receipt-schema";

const allowedRoles = new Set(["OWNER", "ADMIN", "MANAGER", "WAREHOUSE"]);

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

    if (!allowedRoles.has(context.role)) {
      throw new BusinessError("You do not have permission to receive inventory.", "FORBIDDEN");
    }

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
