"use server";

import { revalidatePath } from "next/cache";

import { requireMinimumRole } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { ProductService } from "../services/product-service";
import { deleteProductSchema } from "../validation/product-schema";

export async function deleteProduct(input: unknown) {
  const parsed = deleteProductSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid product.",
    };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    requireMinimumRole(context, "MANAGER");

    await new ProductService().delete(context, parsed.data.id);
    revalidatePath("/products");

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
