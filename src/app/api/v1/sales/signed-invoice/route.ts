import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

import { apiContext } from "@/infrastructure/request/api-context";
import { accountRateLimitOrNull } from "@/infrastructure/rate-limit/enforce";
import { prisma } from "@/infrastructure/database/prisma";
import { uid } from "@/lib/uid";
import { STORAGE_ROOT } from "@/infrastructure/storage/storage-root";
import {
  signedInvoicePath,
  signedInvoiceStorageDir,
  warnIfStorageRootIsPublic,
} from "@/domains/sales/signed-invoice-storage";

const allowedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const maxSize = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const auth = await apiContext(req.headers);
    if (!auth.ok) return auth.response;
    const context = auth.context;
    const limited = accountRateLimitOrNull(context.userId, "signed-invoice-upload");
    if (limited) return limited;

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

    // Storage root, not `public/` -- see signed-invoice-storage.ts.
    warnIfStorageRootIsPublic(STORAGE_ROOT);
    const uploadDir = signedInvoiceStorageDir(STORAGE_ROOT, context.organizationId);
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, fileName), buffer);

    const path = signedInvoicePath(context.organizationId, fileName);

    await prisma.salesOrder.update({
      where: { id: salesOrderId },
      data: { signedInvoicePath: path },
    });

    return NextResponse.json({ ok: true, path });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
