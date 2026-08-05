"use server";

import { revalidatePath } from "next/cache";

import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { LandedCostService } from "../services/landed-cost-service";
import { landedCostCreateSchema } from "../validation/landed-cost-schema";

export async function createLandedCost(input: unknown) {
  const parsed = landedCostCreateSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid request.",
    };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    const landedCost = await new LandedCostService().create(context, parsed.data);
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
