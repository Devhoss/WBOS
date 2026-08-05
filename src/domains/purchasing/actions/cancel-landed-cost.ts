"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { LandedCostService } from "../services/landed-cost-service";

const cancelLandedCostSchema = z.object({
  id: z.string().trim().min(1, "Landed cost is required."),
});

export async function cancelLandedCost(input: unknown) {
  const parsed = cancelLandedCostSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid request.",
    };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    const landedCost = await new LandedCostService().cancel(context, parsed.data.id);

    if (!landedCost) {
      return { ok: false, message: "Landed cost was not found." };
    }

    revalidatePath("/purchasing");
    revalidatePath("/purchasing/landed-costs");

    return { ok: true, id: landedCost.id };
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
