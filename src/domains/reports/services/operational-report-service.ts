import { prisma } from "@/infrastructure/database/prisma";
import { BaseReportRepository, type ReportDateRange } from "../repositories/base-report-repository";

type OperationalFilters = {
  dateRange?: ReportDateRange;
  warehouseId?: string | null;
  search?: string;
};

type ShipmentStatusRow = {
  status: string;
  count: number;
  totalQuantity: number;
};

type DeliveryPerformanceRow = {
  totalShipments: number;
  deliveredOnTime: number;
  deliveredLate: number;
  failed: number;
  onTimeRate: number;
};

type PickingPerformanceRow = {
  totalShipments: number;
  averagePickTimeMinutes: number | null;
  accuracyRate: number;
};

type BarcodeActivityRow = {
  productId: string;
  productName: string;
  productSku: string;
  scanCount: number;
  lastScannedAt: string | null;
};

type WarehouseActivityRow = {
  warehouseId: string;
  warehouseName: string;
  transactionCount: number;
  shipmentCount: number;
  cycleCountCount: number;
};

export class OperationalReportService extends BaseReportRepository {
  async shipmentStatus(filters: OperationalFilters): Promise<ShipmentStatusRow[]> {
    const organizationId = await this.resolveOrganizationId();
    const dateFilter = this.buildDateFilter(filters.dateRange);

    const shipments = await prisma.shipment.findMany({
      where: {
        organizationId,
        ...(dateFilter.gte || dateFilter.lte ? { createdAt: { ...dateFilter } } : {}),
        ...(filters.warehouseId && { warehouseId: filters.warehouseId }),
      },
      select: {
        status: true,
        lines: {
          select: { quantity: true },
        },
      },
    });

    const grouped = new Map<string, { count: number; totalQuantity: number }>();
    for (const shipment of shipments) {
      const existing = grouped.get(shipment.status);
      const qty = shipment.lines.reduce((sum, line) => sum + this.toNumber(line.quantity), 0);
      if (existing) {
        existing.count += 1;
        existing.totalQuantity += qty;
      } else {
        grouped.set(shipment.status, { count: 1, totalQuantity: qty });
      }
    }

    return Array.from(grouped.entries()).map(([status, data]) => ({
      status,
      count: data.count,
      totalQuantity: data.totalQuantity,
    }));
  }

  async deliveryPerformance(filters: OperationalFilters): Promise<DeliveryPerformanceRow> {
    const organizationId = await this.resolveOrganizationId();
    const dateFilter = this.buildDateFilter(filters.dateRange);

    const shipments = await prisma.shipment.findMany({
      where: {
        organizationId,
        status: { in: ["DELIVERED", "FAILED"] },
        ...(dateFilter.gte || dateFilter.lte ? { createdAt: { ...dateFilter } } : {}),
        ...(filters.warehouseId && { warehouseId: filters.warehouseId }),
      },
      select: {
        status: true,
        createdAt: true,
        deliveredAt: true,
        outForDeliveryAt: true,
      },
    });

    let onTime = 0;
    let late = 0;
    let failed = 0;

    for (const s of shipments) {
      if (s.status === "FAILED") {
        failed++;
        continue;
      }

      if (s.outForDeliveryAt && s.deliveredAt) {
        const expectedMs = 24 * 60 * 60 * 1000;
        const actualMs = s.deliveredAt.getTime() - s.outForDeliveryAt.getTime();
        if (actualMs <= expectedMs) onTime++;
        else late++;
      } else {
        onTime++;
      }
    }

    const total = onTime + late + failed;

    return {
      totalShipments: total,
      deliveredOnTime: onTime,
      deliveredLate: late,
      failed,
      onTimeRate: total > 0 ? Math.round((onTime / total) * 100) : 100,
    };
  }

  async pickingPerformance(filters: OperationalFilters): Promise<PickingPerformanceRow> {
    const organizationId = await this.resolveOrganizationId();
    const dateFilter = this.buildDateFilter(filters.dateRange);

    const shipments = await prisma.shipment.findMany({
      where: {
        organizationId,
        pickedAt: { not: null },
        ...(dateFilter.gte || dateFilter.lte ? { createdAt: { ...dateFilter } } : {}),
        ...(filters.warehouseId && { warehouseId: filters.warehouseId }),
      },
      select: {
        createdAt: true,
        pickedAt: true,
        status: true,
        lines: {
          select: { quantity: true, pickedQuantity: true },
        },
      },
    });

    let totalPickMs = 0;
    let pickCount = 0;
    let accurateLines = 0;
    let totalLines = 0;

    for (const s of shipments) {
      if (s.pickedAt) {
        totalPickMs += s.pickedAt.getTime() - s.createdAt.getTime();
        pickCount++;
      }

      for (const line of s.lines) {
        totalLines++;
        const qty = this.toNumber(line.quantity);
        const picked = this.toNumber(line.pickedQuantity);
        if (Math.abs(qty - picked) < 0.001) accurateLines++;
      }
    }

    const avgPickMinutes = pickCount > 0 ? Math.round((totalPickMs / pickCount) / (1000 * 60) * 100) / 100 : null;

    return {
      totalShipments: pickCount,
      averagePickTimeMinutes: avgPickMinutes,
      accuracyRate: totalLines > 0 ? Math.round((accurateLines / totalLines) * 100) : 100,
    };
  }

  async barcodeActivity(filters: OperationalFilters): Promise<BarcodeActivityRow[]> {
    const organizationId = await this.resolveOrganizationId();
    const dateFilter = this.buildDateFilter(filters.dateRange);

    const lines = await prisma.shipmentLine.findMany({
      where: {
        organizationId,
        barcodeVerifiedAt: { not: null },
        ...(dateFilter.gte || dateFilter.lte ? { barcodeVerifiedAt: { ...dateFilter } } : {}),
        shipment: {
          ...(filters.warehouseId && { warehouseId: filters.warehouseId }),
        },
      },
      select: {
        productId: true,
        barcodeVerifiedAt: true,
        product: { select: { name: true, sku: true } },
      },
    });

    const grouped = new Map<string, { productName: string; productSku: string; scanCount: number; lastScannedAt: Date | null }>();
    for (const line of lines) {
      const existing = grouped.get(line.productId);
      if (existing) {
        existing.scanCount += 1;
        if (line.barcodeVerifiedAt && (!existing.lastScannedAt || line.barcodeVerifiedAt > existing.lastScannedAt)) {
          existing.lastScannedAt = line.barcodeVerifiedAt;
        }
      } else {
        grouped.set(line.productId, {
          productName: line.product.name,
          productSku: line.product.sku,
          scanCount: 1,
          lastScannedAt: line.barcodeVerifiedAt,
        });
      }
    }

    return Array.from(grouped.entries()).map(([productId, data]) => ({
      productId,
      productName: data.productName,
      productSku: data.productSku,
      scanCount: data.scanCount,
      lastScannedAt: data.lastScannedAt?.toISOString() ?? null,
    }));
  }

  async warehouseActivity(filters: OperationalFilters): Promise<WarehouseActivityRow[]> {
    const organizationId = await this.resolveOrganizationId();
    const dateFilter = this.buildDateFilter(filters.dateRange);

    const [transactionLines, shipments, cycleCounts] = await Promise.all([
      prisma.inventoryTransactionLine.findMany({
        where: {
          organizationId,
          ...(dateFilter.gte || dateFilter.lte ? {
            transaction: { occurredAt: { ...dateFilter } },
          } : {}),
        },
        select: {
          fromWarehouseId: true,
          toWarehouseId: true,
        },
      }),
      prisma.shipment.findMany({
        where: {
          organizationId,
          ...(dateFilter.gte || dateFilter.lte ? { createdAt: { ...dateFilter } } : {}),
          ...(filters.warehouseId && { warehouseId: filters.warehouseId }),
        },
        select: { warehouseId: true },
      }),
      prisma.cycleCount.findMany({
        where: {
          organizationId,
          ...(dateFilter.gte || dateFilter.lte ? { createdAt: { ...dateFilter } } : {}),
          ...(filters.warehouseId && { warehouseId: filters.warehouseId }),
        },
        select: { warehouseId: true },
      }),
    ]);

    const transactionCountMap = new Map<string, number>();
    for (const tl of transactionLines) {
      if (tl.fromWarehouseId) {
        transactionCountMap.set(tl.fromWarehouseId, (transactionCountMap.get(tl.fromWarehouseId) ?? 0) + 1);
      }
      if (tl.toWarehouseId) {
        transactionCountMap.set(tl.toWarehouseId, (transactionCountMap.get(tl.toWarehouseId) ?? 0) + 1);
      }
    }

    const shipmentCountMap = new Map<string, number>();
    for (const s of shipments) {
      shipmentCountMap.set(s.warehouseId, (shipmentCountMap.get(s.warehouseId) ?? 0) + 1);
    }

    const cycleCountMap = new Map<string, number>();
    for (const cc of cycleCounts) {
      cycleCountMap.set(cc.warehouseId, (cycleCountMap.get(cc.warehouseId) ?? 0) + 1);
    }

    const allWarehouseIds = new Set([...transactionCountMap.keys(), ...shipmentCountMap.keys(), ...cycleCountMap.keys()]);

    const warehouses = await prisma.warehouse.findMany({
      where: { id: { in: [...allWarehouseIds] }, organizationId },
      select: { id: true, name: true },
    });

    const warehouseNameMap = new Map(warehouses.map((w) => [w.id, w.name]));

    return Array.from(allWarehouseIds).map((whId) => ({
      warehouseId: whId,
      warehouseName: warehouseNameMap.get(whId) ?? "Unknown",
      transactionCount: transactionCountMap.get(whId) ?? 0,
      shipmentCount: shipmentCountMap.get(whId) ?? 0,
      cycleCountCount: cycleCountMap.get(whId) ?? 0,
    }));
  }
}
