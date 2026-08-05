import { prisma } from "@/infrastructure/database/prisma";

export type InventoryValuationRow = {
  productId: string;
  productName: string;
  productSku: string;
  warehouseId: string;
  warehouseName: string;
  onHand: number;
  unitCost: number;
  totalValue: number;
};

export type InventoryValuationFilters = {
  warehouseId?: string | null;
  search?: string;
};

export class InventoryValuationService {
  /**
   * Authoritative inventory valuation. Reads the cost-engine cache (ProductCost),
   * which is maintained by CostingService for every inventory movement, landed
   * cost post/cancel, receipt, transfer, adjustment, and cycle count.
   *
   * Both the Inventory Valuation report and the dashboard KPI must call this
   * single method so every screen always shows the same number.
   */
  async valuation(
    organizationId: string,
    filters: InventoryValuationFilters = {},
  ): Promise<InventoryValuationRow[]> {
    const costs = await prisma.productCost.findMany({
      where: {
        organizationId,
        totalQuantity: { gt: 0 },
        ...(filters.warehouseId && { warehouseId: filters.warehouseId }),
        ...(filters.search && {
          product: {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { sku: { contains: filters.search, mode: "insensitive" } },
            ],
          },
        }),
      },
      include: { product: true, warehouse: true },
      orderBy: { averageCost: "desc" },
    });

    return costs.map((c) => ({
      productId: c.productId,
      productName: c.product.name,
      productSku: c.product.sku,
      warehouseId: c.warehouseId,
      warehouseName: c.warehouse.name,
      onHand: this.toNumber(c.totalQuantity),
      unitCost: this.toNumber(c.averageCost),
      totalValue: this.toNumber(c.totalValue),
    }));
  }

  /**
   * Total value of on-hand inventory. Delegates to `valuation()` so the
   * dashboard KPI is guaranteed to equal the Inventory Valuation report.
   */
  async totalValue(
    organizationId: string,
    filters: InventoryValuationFilters = {},
  ): Promise<number> {
    const rows = await this.valuation(organizationId, filters);
    return rows.reduce((sum, row) => sum + row.totalValue, 0);
  }

  private toNumber(value: unknown): number {
    if (value == null) return 0;
    if (typeof value === "number") return value;
    return Number(value);
  }
}
