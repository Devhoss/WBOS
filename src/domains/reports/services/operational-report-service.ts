import { prisma } from "@/infrastructure/database/prisma";
import { BaseReportRepository, type ReportDateRange } from "../repositories/base-report-repository";

type OperationalFilters = {
  dateRange?: ReportDateRange;
  warehouseId?: string | null;
  search?: string;
};

type ShipmentStatusRow = {
  shipmentNumber: string;
  salesOrderNumber: string;
  customer: string;
  status: string;
  warehouse: string;
  itemsCount: number;
  createdDate: string;
};

type DeliveryPerformanceRow = {
  period: string;
  totalDeliveries: number;
  onTime: number;
  late: number;
  onTimeRate: number;
  avgDeliveryTime: string;
};

type PickingPerformanceRow = {
  totalShipments: number;
  averagePickTimeMinutes: number | null;
  accuracyRate: number;
};

type BarcodeActivityRow = {
  dateTime: string;
  product: string;
  sku: string;
  user: string;
  action: string;
  quantity: number;
  status: string;
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
        shipmentNumber: true,
        status: true,
        createdAt: true,
        salesOrder: {
          select: {
            soNumber: true,
            customer: { select: { name: true } },
          },
        },
        warehouse: {
          select: { name: true },
        },
        lines: {
          select: { quantity: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return shipments.map((s) => ({
      shipmentNumber: s.shipmentNumber,
      salesOrderNumber: s.salesOrder?.soNumber ?? "",
      customer: s.salesOrder?.customer?.name ?? "",
      status: s.status,
      warehouse: s.warehouse?.name ?? "",
      itemsCount: s.lines.reduce((sum, line) => sum + this.toNumber(line.quantity), 0),
      createdDate: s.createdAt.toISOString(),
    }));
  }

  async deliveryPerformance(filters: OperationalFilters): Promise<DeliveryPerformanceRow[]> {
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

    type PeriodBucket = {
      totalDeliveries: number; onTime: number; late: number;
      deliveryMsSum: number; deliveryCount: number;
    };
    const buckets = new Map<string, PeriodBucket>();

    for (const s of shipments) {
      const key = s.createdAt.toISOString().slice(0, 7);
      const b = buckets.get(key) ?? { totalDeliveries: 0, onTime: 0, late: 0, deliveryMsSum: 0, deliveryCount: 0 };
      b.totalDeliveries++;

      if (s.status === "FAILED") {
        buckets.set(key, b);
        continue;
      }

      if (s.outForDeliveryAt && s.deliveredAt) {
        const expectedMs = 24 * 60 * 60 * 1000;
        const actualMs = s.deliveredAt.getTime() - s.outForDeliveryAt.getTime();
        if (actualMs <= expectedMs) b.onTime++;
        else b.late++;
        b.deliveryMsSum += actualMs;
        b.deliveryCount++;
      } else {
        b.onTime++;
      }

      buckets.set(key, b);
    }

    return Array.from(buckets.entries()).map(([period, b]) => ({
      period,
      totalDeliveries: b.totalDeliveries,
      onTime: b.onTime,
      late: b.late,
      onTimeRate: b.totalDeliveries > 0 ? Math.round((b.onTime / b.totalDeliveries) * 100) : 100,
      avgDeliveryTime: b.deliveryCount > 0
        ? `${Math.round(b.deliveryMsSum / b.deliveryCount / (1000 * 60))} min`
        : "-",
    }));
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

    const actions = await prisma.pickingAction.findMany({
      where: {
        organizationId,
        ...(dateFilter.gte || dateFilter.lte ? { scannedAt: { ...dateFilter } } : {}),
      },
      select: {
        scannedAt: true,
        createdAt: true,
        delta: true,
        status: true,
        productId: true,
        createdById: true,
      },
      orderBy: { scannedAt: "desc" },
    });

    if (actions.length === 0) return [];

    const productIds = [...new Set(actions.map((a) => a.productId))];
    const userIds = [...new Set(actions.map((a) => a.createdById))];

    const [products, users] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, sku: true },
      }),
      prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      }),
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));
    const userMap = new Map(users.map((u) => [u.id, u]));

    return actions.map((a) => {
      const product = productMap.get(a.productId);
      const delta = this.toNumber(a.delta);
      return {
        dateTime: (a.scannedAt ?? a.createdAt).toISOString(),
        product: product?.name ?? "Unknown",
        sku: product?.sku ?? "",
        user: userMap.get(a.createdById)?.name ?? "Unknown",
        action: delta >= 0 ? "Pick" : "Return",
        quantity: Math.abs(delta),
        status: a.status,
      };
    });
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
