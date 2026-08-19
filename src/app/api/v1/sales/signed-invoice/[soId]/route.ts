import { NextRequest, NextResponse } from "next/server";

import { apiContext } from "@/infrastructure/request/api-context";
import { prisma } from "@/infrastructure/database/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ soId: string }> },
) {
  try {
    const auth = await apiContext(req.headers);
    if (!auth.ok) return auth.response;
    const context = auth.context;
    const { soId } = await params;

    const order = await prisma.salesOrder.findFirst({
      where: { id: soId, organizationId: context.organizationId },
      select: { signedInvoicePath: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Sales order not found." }, { status: 404 });
    }

    return NextResponse.json({ signedInvoicePath: order.signedInvoicePath });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ soId: string }> },
) {
  try {
    const auth = await apiContext(req.headers);
    if (!auth.ok) return auth.response;
    const context = auth.context;
    const { soId } = await params;

    const order = await prisma.salesOrder.findFirst({
      where: { id: soId, organizationId: context.organizationId },
      select: { signedInvoicePath: true },
    });

    if (!order || !order.signedInvoicePath) {
      return NextResponse.json({ error: "No signed invoice to remove." }, { status: 404 });
    }

    await prisma.salesOrder.update({
      where: { id: soId },
      data: { signedInvoicePath: null },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
