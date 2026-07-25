import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";
import { StockBalanceService } from "@/domains/inventory/services/stock-balance-service";

const stockBalanceService = new StockBalanceService();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ barcode: string }> },
) {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext(req.headers);
    const { barcode } = await params;
    const { searchParams } = new URL(req.url);
    const warehouseId = searchParams.get("warehouseId");

    if (!warehouseId) {
      return NextResponse.json(
        { error: { message: "warehouseId query parameter is required", code: "MISSING_PARAM" } },
        { status: 400 },
      );
    }

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
        unitOfMeasure: { select: { name: true } },
      },
    });

    if (!product) {
      return NextResponse.json({ data: null });
    }

    const [balanceDetail, warehouse] = await Promise.all([
      stockBalanceService.getStockBalancesDetail(context.organizationId),
      prisma.warehouse.findFirst({
        where: { id: warehouseId, organizationId: context.organizationId, archivedAt: null },
        select: { id: true, name: true },
      }),
    ]);

    const match = balanceDetail.find(
      (d) => d.productId === product.id && d.warehouseId === warehouseId,
    );

    const result = {
      productId: product.id,
      productSku: product.sku,
      productName: product.name,
      warehouseId,
      warehouseName: warehouse?.name ?? "",
      binLocation: null as string | null,
      quantityOnHand: match ? Number(match.onHand) : 0,
      quantityReserved: match ? Number(match.reserved) : 0,
      quantityAvailable: match ? Number(match.available) : 0,
      unitOfMeasure: product.unitOfMeasure?.name ?? "",
    };

    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof BusinessError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: 403 });
    }
    throw error;
  }
}
