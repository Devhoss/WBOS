"use server";

import { revalidatePath } from "next/cache";

import { requireManager } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { GoodsReceiptService } from "../services/goods-receipt-service";
import { goodsReceiptSchema } from "../validation/goods-receipt-schema";

export async function receiveGoods(input: unknown) {
  const parsed = goodsReceiptSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid goods receipt.",
    };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();

    requireManager(context);

    await new GoodsReceiptService().receive(context, parsed.data);
    revalidatePath("/purchasing");
    revalidatePath("/purchasing/orders");
    revalidatePath("/purchasing/receiving");
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
