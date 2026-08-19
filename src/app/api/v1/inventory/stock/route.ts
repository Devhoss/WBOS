import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { apiContext } from "@/infrastructure/request/api-context";
import { BusinessError } from "@/shared/errors/business-error";
import { StockBalanceService } from "@/domains/inventory/services/stock-balance-service";

const stockBalanceService = new StockBalanceService();

export async function GET(req: NextRequest) {
  try {
    const auth = await apiContext(req.headers);
    if (!auth.ok) return auth.response;
    const context = auth.context;
    const { searchParams } = new URL(req.url);
    const warehouseId = searchParams.get("warehouseId") ?? undefined;
    const productId = searchParams.get("productId") ?? undefined;

    const [details, products, warehouses] = await Promise.all([
      stockBalanceService.getStockBalancesDetail(context.organizationId),
      prisma.product.findMany({
        where: {
          organizationId: context.organizationId,
          archivedAt: null,
          ...(productId && { id: productId }),
        },
        select: {
          id: true,
          sku: true,
          name: true,
          unitOfMeasure: { select: { name: true } },
        },
      }),
      prisma.warehouse.findMany({
        where: { organizationId: context.organizationId, archivedAt: null },
        select: { id: true, name: true },
      }),
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));
    const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));

    let filtered = details;
    if (warehouseId) filtered = filtered.filter((d) => d.warehouseId === warehouseId);
    if (productId) filtered = filtered.filter((d) => d.productId === productId);

    const result = filtered.map((d) => ({
      productId: d.productId,
      productSku: productMap.get(d.productId)?.sku ?? "",
      productName: productMap.get(d.productId)?.name ?? "",
      warehouseId: d.warehouseId,
      warehouseName: warehouseMap.get(d.warehouseId)?.name ?? "",
      binLocation: null as string | null,
      quantityOnHand: Number(d.onHand),
      quantityReserved: Number(d.reserved),
      quantityAvailable: Number(d.available),
      unitOfMeasure: productMap.get(d.productId)?.unitOfMeasure?.name ?? "",
    }));

    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof BusinessError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: 403 });
    }
    throw error;
  }
}
