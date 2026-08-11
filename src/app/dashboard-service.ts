import { prisma } from "@/infrastructure/database/prisma";
import { InventoryValuationService } from "@/domains/inventory/services/inventory-valuation-service";

export type TrendPoint = { label: string; value: number };
export type TopItem = { name: string; value: number };
export type StatusCount = { status: string; count: number };
export type PipelineStatus = {
  salesOrders: StatusCount[];
  purchaseOrders: StatusCount[];
  shipments: StatusCount[];
};
export type UnpaidInvoiceSummary = { totalOutstanding: number; count: number };
export type DelayedItem = {
  type: "po" | "so";
  number: string;
  name: string;
  expectedDate: Date;
  status: string;
  amount: number;
};
export type LowStockItem = { name: string; quantity: number };

export class DashboardService {
  async getOperationalSummary(organizationId: string) {
    const [
      activeProducts,
      openPOCount,
      pendingShipmentCount,
      unpaidInvoiceCount,
      totalUnpaidResult,
      unpaidInvoices,
      recentActivity,
      salesToday,
      salesThisMonth,
      outstandingResult,
      inventoryValueResult,
      overdueCount,
      lowStockThreshold,
    ] = await Promise.all([
      prisma.product.count({
        where: { organizationId, archivedAt: null, status: { not: "ARCHIVED" } },
      }),
      prisma.purchaseOrder.count({
        where: {
          organizationId,
          status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "PARTIALLY_RECEIVED"] },
          archivedAt: null,
        },
      }),
      prisma.shipment.count({
        where: { organizationId, status: { in: ["PENDING_PICK", "PICKING", "PICKED"] } },
      }),
      prisma.invoice.count({
        where: {
          organizationId,
          status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
          archivedAt: null,
        },
      }),
      prisma.invoice.aggregate({
        where: {
          organizationId,
          status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
          archivedAt: null,
        },
        _sum: { totalAmount: true, amountPaid: true },
      }),
      prisma.invoice.findMany({
        where: {
          organizationId,
          status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
          archivedAt: null,
        },
        select: {
          id: true, invoiceNumber: true, status: true, totalAmount: true, amountPaid: true, dueDate: true,
          customer: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.activityLog.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { action: true, summary: true, entityType: true, createdAt: true },
      }),
      prisma.invoice.aggregate({
        where: {
          organizationId,
          status: { in: ["ISSUED", "PAID", "PARTIALLY_PAID"] },
          issuedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
        _sum: { totalAmount: true },
      }),
      prisma.invoice.aggregate({
        where: {
          organizationId,
          status: { in: ["ISSUED", "PAID", "PARTIALLY_PAID"] },
          issuedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
        _sum: { totalAmount: true },
      }),
      prisma.invoice.aggregate({
        where: {
          organizationId,
          status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
        },
        _sum: { totalAmount: true, amountPaid: true },
      }),
      this.getInventoryValue(organizationId),
      prisma.invoice.count({
        where: {
          organizationId,
          status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
          dueDate: { lt: new Date() },
        },
      }),
      this._getLowStockThreshold(organizationId),
    ]);

    const lowStockCountResult = await this._countLowStock(organizationId, lowStockThreshold);
    const totalUnpaid = Number(totalUnpaidResult._sum.totalAmount ?? 0) - Number(totalUnpaidResult._sum.amountPaid ?? 0);
    const outstandingTotal = Number(outstandingResult._sum.totalAmount ?? 0) - Number(outstandingResult._sum.amountPaid ?? 0);

    return {
      stats: { activeProducts, openPOs: openPOCount, pendingShipments: pendingShipmentCount, unpaidInvoices: unpaidInvoiceCount, totalUnpaid },
      kpis: {
        salesToday: Number(salesToday._sum.totalAmount ?? 0),
        salesThisMonth: Number(salesThisMonth._sum.totalAmount ?? 0),
        outstandingReceivables: outstandingTotal,
        inventoryValue: inventoryValueResult,
        overdueCustomers: overdueCount,
        lowStockItems: lowStockCountResult,
        lowStockThreshold,
      },
      unpaidInvoices,
      recentActivity,
    };
  }

  async getSalesTrend(organizationId: string): Promise<TrendPoint[]> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    const monthStart = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth(), 1);

    const rows = await prisma.$queryRaw<{ month: Date; total: unknown }[]>`
      SELECT DATE_TRUNC('month', "issuedAt") AS "month", SUM("totalAmount") AS "total"
      FROM invoices
      WHERE "organizationId" = ${organizationId}
        AND "status" IN ('ISSUED', 'PAID', 'PARTIALLY_PAID')
        AND "issuedAt" >= ${monthStart}
      GROUP BY DATE_TRUNC('month', "issuedAt")
      ORDER BY "month" ASC
    `;

    const byMonth = new Map<string, number>();
    for (const row of rows) {
      const key = new Date(row.month).toISOString().slice(0, 7);
      byMonth.set(key, Number(row.total ?? 0));
    }

    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const key = d.toISOString().slice(0, 7);
      return {
        label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        value: byMonth.get(key) ?? 0,
      };
    });
  }

  async getTopProducts(organizationId: string): Promise<TopItem[]> {
    type GroupResult = { productId: string; _sum: { totalPrice: number | null } };
    const invoiceItems = await prisma.invoiceLine.groupBy({
      by: ["productId"],
      where: {
        invoice: { organizationId, status: { in: ["ISSUED", "PAID", "PARTIALLY_PAID"] } },
      },
      _sum: { totalPrice: true },
      orderBy: { _sum: { totalPrice: "desc" } },
      take: 10,
    }) as unknown as GroupResult[];
    const productIds = invoiceItems.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(products.map((p) => [p.id, p.name]));
    return invoiceItems.map((item: GroupResult) => ({
      name: nameMap.get(item.productId) ?? "Unknown",
      value: Number(item._sum.totalPrice ?? 0),
    }));
  }

  async getTopCustomers(organizationId: string): Promise<TopItem[]> {
    type CustGroupResult = { customerId: string | null; _sum: { totalAmount: number | null } };
    const invoices = await prisma.invoice.groupBy({
      by: ["customerId"],
      where: { organizationId, status: { in: ["ISSUED", "PAID", "PARTIALLY_PAID"] } },
      _sum: { totalAmount: true },
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 10,
    }) as unknown as CustGroupResult[];
    const customerIds = invoices.map((i) => i.customerId).filter(Boolean) as string[];
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(customers.map((c) => [c.id, c.name]));
    return invoices.map((inv: CustGroupResult) => ({
      name: nameMap.get(inv.customerId!) ?? "Unknown",
      value: Number(inv._sum.totalAmount ?? 0),
    }));
  }

  private async getInventoryValue(organizationId: string): Promise<number> {
    return new InventoryValuationService().totalValue(organizationId);
  }

  private async _getLowStockThreshold(organizationId: string): Promise<number> {
    const settings = await prisma.businessSettings.findUnique({
      where: { organizationId },
      select: { lowStockThreshold: true },
    });
    return settings?.lowStockThreshold ?? 10;
  }

  private async _countLowStock(organizationId: string, threshold: number): Promise<number> {
    // Uses product_cost (FIFO cost engine cache) instead of scanning all ledger entries.
    // product_cost has a compound index on (organizationId, productId, warehouseId)
    // so the groupBy is index-driven and O(distinct products), not O(all ledger rows).
    const rows = await prisma.productCost.groupBy({
      by: ["productId"],
      where: { organizationId, totalQuantity: { gt: 0 } },
      _sum: { totalQuantity: true },
      having: { totalQuantity: { _sum: { lt: threshold } } },
    });

    return rows.length;
  }

  async getLowStockItems(organizationId: string, threshold?: number): Promise<LowStockItem[]> {
    const resolvedThreshold = threshold ?? await this._getLowStockThreshold(organizationId);
    type GroupResult = { productId: string; _sum: { totalQuantity: number | null } };
    const rows = await prisma.productCost.groupBy({
      by: ["productId"],
      where: { organizationId, totalQuantity: { gt: 0 } },
      _sum: { totalQuantity: true },
      having: { totalQuantity: { _sum: { lt: resolvedThreshold } } },
      orderBy: { _sum: { totalQuantity: "asc" } },
      take: 5,
    }) as unknown as GroupResult[];

    const productIds = rows.map((r) => r.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(products.map((p) => [p.id, p.name]));

    return rows.map((r) => ({
      name: nameMap.get(r.productId) ?? "Unknown",
      quantity: Number(r._sum.totalQuantity ?? 0),
    }));
  }

  async getPipelineStatus(organizationId: string): Promise<PipelineStatus> {
    const [soGroups, poGroups, shipmentGroups] = await Promise.all([
      prisma.salesOrder.groupBy({
        by: ["status"],
        where: { organizationId, archivedAt: null },
        _count: true,
      }),
      prisma.purchaseOrder.groupBy({
        by: ["status"],
        where: { organizationId, archivedAt: null },
        _count: true,
      }),
      prisma.shipment.groupBy({
        by: ["status"],
        where: { organizationId },
        _count: true,
      }),
    ]);

    return {
      salesOrders: soGroups.map((g) => ({ status: g.status, count: g._count })),
      purchaseOrders: poGroups.map((g) => ({ status: g.status, count: g._count })),
      shipments: shipmentGroups.map((g) => ({ status: g.status, count: g._count })),
    };
  }

  async getUnpaidInvoiceSummary(organizationId: string): Promise<UnpaidInvoiceSummary> {
    const result = await prisma.invoice.aggregate({
      where: {
        organizationId,
        status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
        archivedAt: null,
      },
      _sum: { totalAmount: true, amountPaid: true },
      _count: true,
    });

    const totalOutstanding =
      Number(result._sum.totalAmount ?? 0) - Number(result._sum.amountPaid ?? 0);

    return { totalOutstanding, count: result._count };
  }

  async getDelayedItems(organizationId: string): Promise<DelayedItem[]> {
    const now = new Date();

    const [delayedPOs, delayedSOs] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where: {
          organizationId,
          archivedAt: null,
          status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "PARTIALLY_RECEIVED"] },
          expectedDeliveryDate: { lt: now },
        },
        select: {
          poNumber: true, status: true, totalAmount: true, expectedDeliveryDate: true,
          supplier: { select: { name: true } },
        },
        orderBy: { expectedDeliveryDate: "asc" },
        take: 5,
      }),
      prisma.salesOrder.findMany({
        where: {
          organizationId,
          archivedAt: null,
          status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "READY_FOR_INVOICE"] },
          expectedShipDate: { lt: now },
        },
        select: {
          soNumber: true, status: true, totalAmount: true, expectedShipDate: true,
          customer: { select: { name: true } },
        },
        orderBy: { expectedShipDate: "asc" },
        take: 5,
      }),
    ]);

    const items: DelayedItem[] = [
      ...delayedPOs.map((po) => ({
        type: "po" as const,
        number: po.poNumber,
        name: po.supplier.name,
        expectedDate: po.expectedDeliveryDate!,
        status: po.status,
        amount: Number(po.totalAmount),
      })),
      ...delayedSOs.map((so) => ({
        type: "so" as const,
        number: so.soNumber,
        name: so.customer.name,
        expectedDate: so.expectedShipDate!,
        status: so.status,
        amount: Number(so.totalAmount),
      })),
    ];

    items.sort((a, b) => a.expectedDate.getTime() - b.expectedDate.getTime());
    return items.slice(0, 5);
  }
}
