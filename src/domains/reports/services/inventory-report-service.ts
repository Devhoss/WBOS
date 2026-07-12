import { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";
import { BaseReportRepository, type ReportDateRange } from "../repositories/base-report-repository";

type InventoryFilters = {
  dateRange?: ReportDateRange;
  warehouseId?: string | null;
  productId?: string | null;
  search?: string;
};

type CurrentStockRow = {
  productId: string;
  productName: string;
  productSku: string;
  warehouseId: string;
  warehouseName: string;
  onHand: number;
};

type ValuationRow = {
  productId: string;
  productName: string;
  productSku: string;
  onHand: number;
  unitCost: number;
  totalValue: number;
};

type StockMovementRow = {
  movementType: string;
  direction: string;
  totalQuantity: number;
  transactionCount: number;
};

type AgingRow = {
  productId: string;
  productName: string;
  productSku: string;
  warehouseName: string;
  onHand: number;
  daysSinceLastMovement: number;
};

type SlowMovingRow = {
  productId: string;
  productName: string;
  productSku: string;
  onHand: number;
  movementInPeriod: number;
};

type NegativeStockRow = {
  productId: string;
  productName: string;
  productSku: string;
  warehouseName: string;
  netQuantity: number;
};

type ReservedStockRow = {
  productId: string;
  productName: string;
  productSku: string;
  warehouseName: string;
  reservedQuantity: number;
};

type CycleCountRow = {
  cycleCountId: string;
  countNumber: string;
  warehouseName: string;
  status: string;
  totalItems: number;
  countedItems: number;
  varianceItems: number;
  countedAt: string | null;
};

export class InventoryReportService extends BaseReportRepository {
  async currentStock(filters: InventoryFilters, warehouseId?: string): Promise<CurrentStockRow[]> {
    const organizationId = await this.resolveOrganizationId();
    const whId = warehouseId ?? filters.warehouseId;

    const entries = await prisma.inventoryLedgerEntry.groupBy({
      by: ["productId", "warehouseId", "direction"],
      where: {
        organizationId,
        ...(whId && { warehouseId: whId }),
        ...(filters.productId && { productId: filters.productId }),
      },
      _sum: { quantity: true },
    });

    const productIds = [...new Set(entries.map((e) => e.productId))];
    const warehouseIds = [...new Set(entries.map((e) => e.warehouseId))];

    const [products, warehouses] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, sku: true },
      }),
      prisma.warehouse.findMany({
        where: { id: { in: warehouseIds } },
        select: { id: true, name: true },
      }),
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));
    const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));

    const balanceMap = new Map<string, number>();
    for (const entry of entries) {
      const key = `${entry.productId}:${entry.warehouseId}`;
      const qty = this.toNumber(entry._sum.quantity);
      const current = balanceMap.get(key) ?? 0;
      balanceMap.set(key, entry.direction === "IN" ? current + qty : current - qty);
    }

    return Array.from(balanceMap.entries())
      .filter(([_, qty]) => qty !== 0)
      .map(([key, onHand]) => {
        const [productId, wid] = key.split(":");
        const product = productMap.get(productId);
        const warehouse = warehouseMap.get(wid);
        return {
          productId,
          productName: product?.name ?? "Unknown",
          productSku: product?.sku ?? "",
          warehouseId: wid,
          warehouseName: warehouse?.name ?? "Unknown",
          onHand,
        };
      });
  }

  async valuation(filters: InventoryFilters): Promise<ValuationRow[]> {
    const stockRows = await this.currentStock({ ...filters, warehouseId: null });
    const productIds = stockRows.map((r) => r.productId);

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, defaultSellingPrice: true },
    });

    const costMap = new Map(products.map((p) => [p.id, this.toNumber(p.defaultSellingPrice)]));

    return stockRows.map((row) => {
      const unitCost = costMap.get(row.productId) ?? 0;
      return {
        productId: row.productId,
        productName: row.productName,
        productSku: row.productSku,
        onHand: row.onHand,
        unitCost,
        totalValue: row.onHand * unitCost,
      };
    });
  }

  async stockMovement(filters: InventoryFilters): Promise<StockMovementRow[]> {
    const organizationId = await this.resolveOrganizationId();
    const dateFilter = this.buildDateFilter(filters.dateRange);

    const lines = await prisma.inventoryTransactionLine.findMany({
      where: {
        organizationId,
        transaction: {
          status: "POSTED",
          ...(dateFilter.gte || dateFilter.lte ? { occurredAt: { ...dateFilter } } : {}),
        },
      },
      select: {
        quantity: true,
        transaction: {
          select: {
            type: true,
          },
        },
        ledgerEntries: {
          select: { direction: true },
          take: 1,
        },
      },
    });

    const grouped = new Map<string, { totalQuantity: number; transactionCount: number }>();
    for (const line of lines) {
      const direction = line.ledgerEntries[0]?.direction ?? "IN";
      const key = `${line.transaction.type}:${direction}`;
      const existing = grouped.get(key);
      const qty = this.toNumber(line.quantity);
      if (existing) {
        existing.totalQuantity += qty;
        existing.transactionCount += 1;
      } else {
        grouped.set(key, { totalQuantity: qty, transactionCount: 1 });
      }
    }

    return Array.from(grouped.entries()).map(([key, data]) => {
      const [movementType, direction] = key.split(":");
      return {
        movementType,
        direction,
        totalQuantity: data.totalQuantity,
        transactionCount: data.transactionCount,
      };
    });
  }

  async aging(filters: InventoryFilters): Promise<AgingRow[]> {
    const organizationId = await this.resolveOrganizationId();
    const whId = filters.warehouseId;
    const now = new Date();

    const entries = await prisma.inventoryLedgerEntry.groupBy({
      by: ["productId", "warehouseId", "direction"],
      where: {
        organizationId,
        ...(whId && { warehouseId: whId }),
        ...(filters.productId && { productId: filters.productId }),
      },
      _sum: { quantity: true },
      _max: { occurredAt: true },
    });

    const productIds = [...new Set(entries.map((e) => e.productId))];
    const warehouseIds = [...new Set(entries.map((e) => e.warehouseId))];

    const [products, warehouses] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, sku: true },
      }),
      prisma.warehouse.findMany({
        where: { id: { in: warehouseIds } },
        select: { id: true, name: true },
      }),
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));
    const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));
    const balanceMap = new Map<string, { onHand: number; lastMovement: Date | null }>();

    for (const entry of entries) {
      const key = `${entry.productId}:${entry.warehouseId}`;
      const qty = this.toNumber(entry._sum.quantity);
      const current = balanceMap.get(key) ?? { onHand: 0, lastMovement: null };
      const newQty = entry.direction === "IN" ? current.onHand + qty : current.onHand - qty;
      const last = entry._max.occurredAt;
      balanceMap.set(key, {
        onHand: newQty,
        lastMovement: last && (!current.lastMovement || last > current.lastMovement) ? last : current.lastMovement,
      });
    }

    return Array.from(balanceMap.entries())
      .filter(([_, data]) => data.onHand !== 0)
      .map(([key, data]) => {
        const [productId, wid] = key.split(":");
        const product = productMap.get(productId);
        const warehouse = warehouseMap.get(wid);
        const daysSinceLastMovement = data.lastMovement
          ? Math.round((now.getTime() - data.lastMovement.getTime()) / (1000 * 60 * 60 * 24))
          : 999;
        return {
          productId,
          productName: product?.name ?? "Unknown",
          productSku: product?.sku ?? "",
          warehouseName: warehouse?.name ?? "Unknown",
          onHand: data.onHand,
          daysSinceLastMovement,
        };
      });
  }

  async slowMoving(filters: InventoryFilters, days = 90): Promise<SlowMovingRow[]> {
    const organizationId = await this.resolveOrganizationId();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const stockRows = await this.currentStock(filters);

    const productIds = stockRows.map((r) => r.productId);

    const recentLines = await prisma.inventoryTransactionLine.findMany({
      where: {
        organizationId,
        productId: { in: productIds },
        transaction: {
          occurredAt: { gte: cutoff },
          status: "POSTED",
        },
      },
      select: {
        productId: true,
        quantity: true,
      },
    });

    const movementMap = new Map<string, number>();
    for (const line of recentLines) {
      const current = movementMap.get(line.productId) ?? 0;
      movementMap.set(line.productId, current + this.toNumber(line.quantity));
    }

    return stockRows
      .filter((row) => {
        const movement = movementMap.get(row.productId) ?? 0;
        return movement === 0 || row.onHand === 0;
      })
      .map((row) => ({
        productId: row.productId,
        productName: row.productName,
        productSku: row.productSku,
        onHand: row.onHand,
        movementInPeriod: movementMap.get(row.productId) ?? 0,
      }));
  }

  async fastMoving(filters: InventoryFilters, days = 30): Promise<SlowMovingRow[]> {
    const organizationId = await this.resolveOrganizationId();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const stockRows = await this.currentStock(filters);
    const productIds = stockRows.map((r) => r.productId);

    const recentLines = await prisma.inventoryTransactionLine.findMany({
      where: {
        organizationId,
        productId: { in: productIds },
        transaction: {
          occurredAt: { gte: cutoff },
          status: "POSTED",
        },
      },
      select: {
        productId: true,
        quantity: true,
      },
    });

    const movementMap = new Map<string, number>();
    for (const line of recentLines) {
      const current = movementMap.get(line.productId) ?? 0;
      movementMap.set(line.productId, current + this.toNumber(line.quantity));
    }

    return stockRows
      .filter((row) => {
        const movement = movementMap.get(row.productId) ?? 0;
        return movement > 0;
      })
      .map((row) => ({
        productId: row.productId,
        productName: row.productName,
        productSku: row.productSku,
        onHand: row.onHand,
        movementInPeriod: movementMap.get(row.productId) ?? 0,
      }))
      .sort((a, b) => b.movementInPeriod - a.movementInPeriod);
  }

  async negativeStock(): Promise<NegativeStockRow[]> {
    const organizationId = await this.resolveOrganizationId();

    const entries = await prisma.inventoryLedgerEntry.groupBy({
      by: ["productId", "warehouseId", "direction"],
      where: { organizationId },
      _sum: { quantity: true },
    });

    const productIds = [...new Set(entries.map((e) => e.productId))];
    const warehouseIds = [...new Set(entries.map((e) => e.warehouseId))];

    const [products, warehouses] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, sku: true },
      }),
      prisma.warehouse.findMany({
        where: { id: { in: warehouseIds } },
        select: { id: true, name: true },
      }),
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));
    const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));
    const balanceMap = new Map<string, number>();

    for (const entry of entries) {
      const key = `${entry.productId}:${entry.warehouseId}`;
      const qty = this.toNumber(entry._sum.quantity);
      const current = balanceMap.get(key) ?? 0;
      balanceMap.set(key, entry.direction === "IN" ? current + qty : current - qty);
    }

    return Array.from(balanceMap.entries())
      .filter(([_, qty]) => qty < 0)
      .map(([key, netQuantity]) => {
        const [productId, wid] = key.split(":");
        const product = productMap.get(productId);
        const warehouse = warehouseMap.get(wid);
        return {
          productId,
          productName: product?.name ?? "Unknown",
          productSku: product?.sku ?? "",
          warehouseName: warehouse?.name ?? "Unknown",
          netQuantity,
        };
      });
  }

  async reservedStock(): Promise<ReservedStockRow[]> {
    const organizationId = await this.resolveOrganizationId();

    const lines = await prisma.shipmentLine.findMany({
      where: {
        organizationId,
        shipment: {
          status: { notIn: ["DELIVERED", "FAILED"] },
        },
      },
      select: {
        productId: true,
        quantity: true,
        product: { select: { name: true, sku: true } },
        shipment: {
          select: {
            warehouseId: true,
            warehouse: { select: { name: true } },
          },
        },
      },
    });

    const grouped = new Map<string, { productName: string; productSku: string; warehouseName: string; reservedQuantity: number }>();
    for (const line of lines) {
      const key = `${line.productId}:${line.shipment.warehouseId}`;
      const existing = grouped.get(key);
      const qty = this.toNumber(line.quantity);
      if (existing) {
        existing.reservedQuantity += qty;
      } else {
        grouped.set(key, {
          productName: line.product.name,
          productSku: line.product.sku,
          warehouseName: line.shipment.warehouse.name,
          reservedQuantity: qty,
        });
      }
    }

    return Array.from(grouped.entries()).map(([key, data]) => {
      const [productId] = key.split(":");
      return {
        productId,
        productName: data.productName,
        productSku: data.productSku,
        warehouseName: data.warehouseName,
        reservedQuantity: data.reservedQuantity,
      };
    });
  }

  async cycleCountHistory(filters: InventoryFilters): Promise<CycleCountRow[]> {
    const organizationId = await this.resolveOrganizationId();
    const dateFilter = this.buildDateFilter(filters.dateRange);
    const whId = filters.warehouseId;

    const counts = await prisma.cycleCount.findMany({
      where: {
        organizationId,
        ...(whId && { warehouseId: whId }),
        ...(dateFilter.gte || dateFilter.lte ? { createdAt: { ...dateFilter } } : {}),
      },
      select: {
        id: true,
        countNumber: true,
        status: true,
        countedAt: true,
        warehouse: { select: { name: true } },
        lines: {
          select: {
            expectedQty: true,
            countedQty: true,
            variance: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return counts.map((cc) => ({
      cycleCountId: cc.id,
      countNumber: cc.countNumber,
      warehouseName: cc.warehouse.name,
      status: cc.status,
      totalItems: cc.lines.length,
      countedItems: cc.lines.filter((l) => l.countedQty != null).length,
      varianceItems: cc.lines.filter((l) => l.variance != null && this.toNumber(l.variance) !== 0).length,
      countedAt: cc.countedAt?.toISOString() ?? null,
    }));
  }
}
