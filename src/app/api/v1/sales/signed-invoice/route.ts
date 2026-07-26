import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";

import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { prisma } from "@/infrastructure/database/prisma";
import { uid } from "@/lib/uid";

const allowedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const maxSize = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext(req.headers);

    const formData = await req.formData();
    const salesOrderId = formData.get("salesOrderId") as string | null;
    const file = formData.get("file") as File | null;

    if (!salesOrderId || !file) {
      return NextResponse.json({ error: "Missing salesOrderId or file." }, { status: 400 });
    }

    if (!allowedMimeTypes.has(file.type)) {
      return NextResponse.json({ error: "Only PDF, JPG, and PNG files are allowed." }, { status: 400 });
    }

    if (file.size > maxSize) {
      return NextResponse.json({ error: "File size must be under 10 MB." }, { status: 400 });
    }

    const order = await prisma.salesOrder.findFirst({
      where: { id: salesOrderId, organizationId: context.organizationId },
      select: { soNumber: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Sales order not found." }, { status: 404 });
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

    return NextResponse.json({ ok: true, path: `/uploads/${fileName}` });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
