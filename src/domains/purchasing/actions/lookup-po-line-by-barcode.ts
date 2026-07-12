"use server";

import { z } from "zod";

import { prisma } from "@/infrastructure/database/prisma";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

const lookupSchema = z.object({
  barcode: z.string().min(1),
  purchaseOrderId: z.string().min(1),
});

export async function lookupPOLineByBarcode(input: unknown) {
  const parsed = lookupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid input." };

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();

    const product = await prisma.product.findFirst({
      where: { barcode: parsed.data.barcode, organizationId: context.organizationId },
      select: { id: true, sku: true, name: true, barcode: true },
    });

    if (!product) {
      return { ok: false, message: `No product found with barcode "${parsed.data.barcode}".` };
    }

    const poLine = await prisma.purchaseOrderLine.findFirst({
      where: {
        purchaseOrderId: parsed.data.purchaseOrderId,
        productId: product.id,
        organizationId: context.organizationId,
      },
      select: {
        id: true,
        orderedQuantity: true,
        receivedQuantity: true,
      },
    });

    if (!poLine) {
      return { ok: false, message: `Product "${product.name}" is not on this purchase order.` };
    }

    const remaining = Number(poLine.orderedQuantity) - Number(poLine.receivedQuantity);

    return {
      ok: true,
      data: {
        purchaseOrderLineId: poLine.id,
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        remaining,
        orderedQuantity: Number(poLine.orderedQuantity),
      },
    };
  } catch {
    return { ok: false, message: "Lookup failed." };
  }
}
