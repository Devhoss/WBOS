"use server";

import { revalidatePath } from "next/cache";
import { writeFile } from "fs/promises";
import { join } from "path";

import { prisma } from "@/infrastructure/database/prisma";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { uid } from "@/lib/uid";

const allowedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);

export async function uploadSignedInvoiceAction(formData: FormData) {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const salesOrderId = formData.get("salesOrderId") as string;
  const file = formData.get("file") as File | null;

  if (!salesOrderId || !file) {
    return { ok: false, message: "Missing sales order ID or file." };
  }

  if (!allowedMimeTypes.has(file.type)) {
    return { ok: false, message: "Only PDF, JPG, and PNG files are allowed." };
  }

  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, message: "File size must be under 10 MB." };
  }

  const order = await prisma.salesOrder.findFirst({
    where: { id: salesOrderId, organizationId: context.organizationId },
  });

  if (!order) {
    return { ok: false, message: "Sales order not found." };
  }

  const ext = file.name.split(".").pop() ?? "pdf";
  const fileName = `signed-invoice-${order.soNumber}-${uid()}.${ext}`;
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const uploadDir = join(process.cwd(), "public", "uploads");
  await writeFile(join(uploadDir, fileName), buffer);

  await prisma.salesOrder.update({
    where: { id: salesOrderId },
    data: { signedInvoicePath: `/uploads/${fileName}` },
  });

  revalidatePath(`/sales/orders/${salesOrderId}`);
  return { ok: true };
}

export async function removeSignedInvoiceAction(salesOrderId: string) {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();

  const order = await prisma.salesOrder.findFirst({
    where: { id: salesOrderId, organizationId: context.organizationId },
  });

  if (!order || !order.signedInvoicePath) {
    return { ok: false, message: "No signed invoice to remove." };
  }

  await prisma.salesOrder.update({
    where: { id: salesOrderId },
    data: { signedInvoicePath: null },
  });

  revalidatePath(`/sales/orders/${salesOrderId}`);
  return { ok: true };
}
