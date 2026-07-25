import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ barcode: string }> },
) {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    const { barcode } = await params;

    const product = await prisma.product.findFirst({
      where: {
        organizationId: context.organizationId,
        OR: [
          { barcode: barcode },
          { sku: barcode },
        ],
        archivedAt: null,
      },
      select: {
        id: true,
        sku: true,
        name: true,
        barcode: true,
      },
    });

    if (!product) {
      return NextResponse.json({
        data: {
          barcode,
          type: "unknown",
          id: "",
          label: "Unknown Barcode",
        },
      });
    }

    return NextResponse.json({
      data: {
        barcode: product.barcode ?? barcode,
        type: "product" as const,
        id: product.id,
        label: product.name,
      },
    });
  } catch (error) {
    if (error instanceof BusinessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
