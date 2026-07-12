"use server";

import { z } from "zod";

import { prisma } from "@/infrastructure/database/prisma";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

const lookupSchema = z.object({ barcode: z.string().min(1) });

export async function lookupProductByBarcode(input: unknown) {
  const parsed = lookupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid barcode." };

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();

    const product = await prisma.product.findFirst({
      where: { barcode: parsed.data.barcode, organizationId: context.organizationId },
      select: { id: true, sku: true, name: true, barcode: true, status: true },
    });

    if (!product) {
      return { ok: false, message: `No product found with barcode "${parsed.data.barcode}".` };
    }

    return { ok: true, data: product };
  } catch {
    return { ok: false, message: "Lookup failed." };
  }
}
