import { prisma } from "@/infrastructure/database/prisma";
import { BaseReportRepository, type ReportDateRange } from "../repositories/base-report-repository";

type PurchasingFilters = {
  dateRange?: ReportDateRange;
  supplierId?: string | null;
  search?: string;
};

type BySupplierRow = {
  supplierId: string;
  supplierName: string;
  totalAmount: number;
  orderCount: number;
};

type ByProductRow = {
  productId: string;
  productName: string;
  productSku: string;
  totalOrdered: number;
  totalReceived: number;
  totalCost: number;
};

type OutstandingOrderRow = {
  purchaseOrderId: string;
  poNumber: string;
  supplierName: string;
  totalAmount: number;
  receivedValue: number;
  outstandingValue: number;
  status: string;
  expectedDeliveryDate: string | null;
  orderedAt: string;
};

type SupplierPerformanceRow = {
  supplierId: string;
  supplierName: string;
  orderCount: number;
  averageLeadTimeDays: number | null;
  onTimeDeliveryRate: number;
};

type ReceivingHistoryRow = {
  transactionId: string;
  documentNumber: string | null;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  receivedAt: string;
  supplierName: string | null;
  notes: string | null;
};

export class PurchasingReportService extends BaseReportRepository {
  async bySupplier(filters: PurchasingFilters): Promise<BySupplierRow[]> {
    const organizationId = await this.resolveOrganizationId();
    const dateFilter = this.buildDateFilter(filters.dateRange);

    const orders = await prisma.purchaseOrder.findMany({
      where: {
        organizationId,
        status: { notIn: ["DRAFT", "CANCELLED"] },
        ...(dateFilter.gte || dateFilter.lte ? { orderedAt: { ...dateFilter } } : {}),
        ...(filters.supplierId && { supplierId: filters.supplierId }),
      },
      select: {
        supplierId: true,
        totalAmount: true,
        supplier: { select: { name: true } },
      },
    });

    const grouped = new Map<string, { supplierName: string; totalAmount: number; orderCount: number }>();
    for (const order of orders) {
      const existing = grouped.get(order.supplierId);
      const amt = this.toNumber(order.totalAmount);
      if (existing) {
        existing.totalAmount += amt;
        existing.orderCount += 1;
      } else {
        grouped.set(order.supplierId, {
          supplierName: order.supplier.name,
          totalAmount: amt,
          orderCount: 1,
        });
      }
    }

    return Array.from(grouped.entries()).map(([supplierId, data]) => ({
      supplierId,
      supplierName: data.supplierName,
      totalAmount: data.totalAmount,
      orderCount: data.orderCount,
    }));
  }

  async byProduct(filters: PurchasingFilters): Promise<ByProductRow[]> {
    const organizationId = await this.resolveOrganizationId();
    const dateFilter = this.buildDateFilter(filters.dateRange);

    const lines = await prisma.purchaseOrderLine.findMany({
      where: {
        organizationId,
        purchaseOrder: {
          status: { notIn: ["DRAFT", "CANCELLED"] },
          ...(dateFilter.gte || dateFilter.lte ? { orderedAt: { ...dateFilter } } : {}),
          ...(filters.supplierId && { supplierId: filters.supplierId }),
        },
      },
      select: {
        productId: true,
        orderedQuantity: true,
        receivedQuantity: true,
        totalCost: true,
        product: { select: { name: true, sku: true } },
      },
    });

    const grouped = new Map<string, { productName: string; productSku: string; totalOrdered: number; totalReceived: number; totalCost: number }>();
    for (const line of lines) {
      const existing = grouped.get(line.productId);
      const ordered = this.toNumber(line.orderedQuantity);
      const received = this.toNumber(line.receivedQuantity);
      const cost = this.toNumber(line.totalCost);
      if (existing) {
        existing.totalOrdered += ordered;
        existing.totalReceived += received;
        existing.totalCost += cost;
      } else {
        grouped.set(line.productId, {
          productName: line.product.name,
          productSku: line.product.sku,
          totalOrdered: ordered,
          totalReceived: received,
          totalCost: cost,
        });
      }
    }

    return Array.from(grouped.entries()).map(([productId, data]) => ({
      productId,
      productName: data.productName,
      productSku: data.productSku,
      totalOrdered: data.totalOrdered,
      totalReceived: data.totalReceived,
      totalCost: data.totalCost,
    }));
  }

  async outstandingOrders(filters: PurchasingFilters): Promise<OutstandingOrderRow[]> {
    const organizationId = await this.resolveOrganizationId();
    const dateFilter = this.buildDateFilter(filters.dateRange);

    const orders = await prisma.purchaseOrder.findMany({
      where: {
        organizationId,
        status: { in: ["APPROVED", "PARTIALLY_RECEIVED"] },
        ...(dateFilter.gte || dateFilter.lte ? { orderedAt: { ...dateFilter } } : {}),
        ...(filters.supplierId && { supplierId: filters.supplierId }),
      },
      select: {
        id: true,
        poNumber: true,
        totalAmount: true,
        status: true,
        expectedDeliveryDate: true,
        orderedAt: true,
        supplier: { select: { name: true } },
        lines: {
          select: { receivedQuantity: true, totalCost: true },
        },
      },
      orderBy: { orderedAt: "desc" },
    });

    return orders.map((po) => {
      const receivedValue = po.lines.reduce(
        (sum, line) => sum + this.toNumber(line.receivedQuantity) * (this.toNumber(line.totalCost) / Math.max(this.toNumber(line.receivedQuantity), 1)),
        0,
      );

      return {
        purchaseOrderId: po.id,
        poNumber: po.poNumber,
        supplierName: po.supplier.name,
        totalAmount: this.toNumber(po.totalAmount),
        receivedValue,
        outstandingValue: this.toNumber(po.totalAmount) - receivedValue,
        status: po.status,
        expectedDeliveryDate: po.expectedDeliveryDate?.toISOString() ?? null,
        orderedAt: po.orderedAt.toISOString(),
      };
    });
  }

  async supplierPerformance(filters: PurchasingFilters): Promise<SupplierPerformanceRow[]> {
    const organizationId = await this.resolveOrganizationId();
    const dateFilter = this.buildDateFilter(filters.dateRange);

    const orders = await prisma.purchaseOrder.findMany({
      where: {
        organizationId,
        status: { in: ["APPROVED", "PARTIALLY_RECEIVED", "FULLY_RECEIVED"] },
        ...(dateFilter.gte || dateFilter.lte ? { orderedAt: { ...dateFilter } } : {}),
        ...(filters.supplierId && { supplierId: filters.supplierId }),
      },
      select: {
        id: true,
        supplierId: true,
        expectedDeliveryDate: true,
        orderedAt: true,
        supplier: { select: { name: true, leadTimeDays: true } },
      },
    });

    const poIds = orders.map((o) => o.id);
    const receipts = await prisma.inventoryTransaction.findMany({
      where: {
        organizationId,
        type: "PURCHASE_RECEIPT",
        referenceType: "PurchaseOrder",
        referenceId: { in: poIds },
      },
      select: { referenceId: true, occurredAt: true },
    });

    const receiptMap = new Map<string, Date>();
    for (const r of receipts) {
      if (r.referenceId && (!receiptMap.has(r.referenceId) || r.occurredAt < receiptMap.get(r.referenceId)!)) {
        receiptMap.set(r.referenceId, r.occurredAt);
      }
    }

    const grouped = new Map<string, {
      supplierName: string;
      leadTimeDays: number | null;
      orders: { orderedAt: Date; expectedDeliveryDate: Date | null; actualDeliveryDate: Date | null }[];
    }>();

    for (const order of orders) {
      const existing = grouped.get(order.supplierId);
      const actualDeliveryDate = receiptMap.get(order.id) ?? null;
      const entry = {
        orderedAt: order.orderedAt,
        expectedDeliveryDate: order.expectedDeliveryDate,
        actualDeliveryDate,
      };
      if (existing) {
        existing.orders.push(entry);
      } else {
        grouped.set(order.supplierId, {
          supplierName: order.supplier.name,
          leadTimeDays: order.supplier.leadTimeDays ?? null,
          orders: [entry],
        });
      }
    }

    return Array.from(grouped.entries()).map(([supplierId, data]) => {
      const ordersWithDates = data.orders.filter((o) => o.expectedDeliveryDate != null);
      const avgLeadTime = ordersWithDates.length > 0
        ? ordersWithDates.reduce((sum, o) => {
            const diff = Math.round((o.expectedDeliveryDate!.getTime() - o.orderedAt.getTime()) / (1000 * 60 * 60 * 24));
            return sum + diff;
          }, 0) / ordersWithDates.length
        : (data.leadTimeDays ?? null);

      const deliveredWithExpected = data.orders.filter(
        (o) => o.actualDeliveryDate != null && o.expectedDeliveryDate != null,
      );
      const onTime = deliveredWithExpected.filter(
        (o) => o.actualDeliveryDate! <= o.expectedDeliveryDate!,
      ).length;
      const onTimeDeliveryRate = deliveredWithExpected.length > 0
        ? Math.round((onTime / deliveredWithExpected.length) * 100)
        : 0;

      return {
        supplierId,
        supplierName: data.supplierName,
        orderCount: data.orders.length,
        averageLeadTimeDays: avgLeadTime,
        onTimeDeliveryRate,
      };
    });
  }

  async receivingHistory(filters: PurchasingFilters): Promise<ReceivingHistoryRow[]> {
    const organizationId = await this.resolveOrganizationId();
    const dateFilter = this.buildDateFilter(filters.dateRange);

    const transactions = await prisma.inventoryTransaction.findMany({
      where: {
        organizationId,
        type: "PURCHASE_RECEIPT",
        status: "POSTED",
        ...(dateFilter.gte || dateFilter.lte ? { occurredAt: { ...dateFilter } } : {}),
      },
      select: {
        id: true,
        documentNumber: true,
        occurredAt: true,
        notes: true,
        lines: {
          select: {
            productId: true,
            quantity: true,
            product: { select: { name: true, sku: true } },
          },
        },
      },
      orderBy: { occurredAt: "desc" },
    });

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        organizationId,
        status: { in: ["PARTIALLY_RECEIVED", "FULLY_RECEIVED"] },
      },
      select: {
        id: true,
        supplier: { select: { name: true } },
      },
    });

    const supplierMap = new Map(purchaseOrders.map((po) => [po.id, po.supplier.name]));

    const rows: ReceivingHistoryRow[] = [];
    for (const tx of transactions) {
      for (const line of tx.lines) {
        rows.push({
          transactionId: tx.id,
          documentNumber: tx.documentNumber,
          productId: line.productId,
          productName: line.product.name,
          productSku: line.product.sku,
          quantity: this.toNumber(line.quantity),
          receivedAt: tx.occurredAt.toISOString(),
          supplierName: null,
          notes: tx.notes,
        });
      }
    }

    return rows;
  }
}
