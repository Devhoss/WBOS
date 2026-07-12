import { prisma } from "@/infrastructure/database/prisma";

export type TrendPoint = { label: string; value: number };
export type TopItem = { name: string; value: number };

export class DashboardService {
  async getOperationalSummary(organizationId: string) {
    const [
      activeProducts,
      openPOCount,
      pendingShipmentCount,
      unpaidInvoiceCount,
      totalUnpaidResult,
      openPOs,
      pendingShipments,
      unpaidInvoices,
      recentActivity,
      salesToday,
      salesThisMonth,
      outstandingResult,
      inventoryValueResult,
      overdueCount,
      lowStockCountResult,
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
      prisma.purchaseOrder.findMany({
        where: {
          organizationId,
          status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "PARTIALLY_RECEIVED"] },
          archivedAt: null,
        },
        select: {
          id: true, poNumber: true, status: true, totalAmount: true,
          supplier: { select: { name: true } },
        },
        orderBy: { orderedAt: "desc" },
        take: 5,
      }),
      prisma.shipment.findMany({
        where: { organizationId, status: { in: ["PENDING_PICK", "PICKING", "PICKED"] } },
        select: {
          id: true, shipmentNumber: true, status: true,
          salesOrder: { select: { soNumber: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
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
      this.getLowStockCount(organizationId, 10),
    ]);

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
      },
      openPOs,
      pendingShipments,
      unpaidInvoices,
      recentActivity,
    };
  }

  async getSalesTrend(organizationId: string): Promise<TrendPoint[]> {
    const months: TrendPoint[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const result = await prisma.invoice.aggregate({
        where: {
          organizationId,
          status: { in: ["ISSUED", "PAID", "PARTIALLY_PAID"] },
          issuedAt: { gte: monthStart, lt: monthEnd },
        },
        _sum: { totalAmount: true },
      });
      months.push({
        label: monthStart.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        value: Number(result._sum.totalAmount ?? 0),
      });
    }
    return months;
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
    const entries = await prisma.inventoryLedgerEntry.groupBy({
      by: ["productId", "warehouseId", "direction"],
      where: { organizationId },
      _sum: { quantity: true },
    });
    const productIds = [...new Set(entries.map((e) => e.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, defaultSellingPrice: true },
    });
    const priceMap = new Map(products.map((p) => [p.id, Number(p.defaultSellingPrice)]));
    const balanceMap = new Map<string, number>();
    for (const entry of entries) {
      const key = `${entry.productId}:${entry.warehouseId}`;
      const qty = Number(entry._sum.quantity);
      const current = balanceMap.get(key) ?? 0;
      balanceMap.set(key, entry.direction === "IN" ? current + qty : current - qty);
    }
    let totalValue = 0;
    for (const [key, qty] of balanceMap) {
      if (qty <= 0) continue;
      totalValue += qty * (priceMap.get(key.split(":")[0]) ?? 0);
    }
    return totalValue;
  }

  private async getLowStockCount(organizationId: string, threshold: number): Promise<number> {
    const entries = await prisma.inventoryLedgerEntry.groupBy({
      by: ["productId", "warehouseId", "direction"],
      where: { organizationId },
      _sum: { quantity: true },
    });
    const balanceMap = new Map<string, number>();
    for (const entry of entries) {
      const key = `${entry.productId}:${entry.warehouseId}`;
      const qty = Number(entry._sum.quantity);
      const current = balanceMap.get(key) ?? 0;
      balanceMap.set(key, entry.direction === "IN" ? current + qty : current - qty);
    }
    const productOnHand = new Map<string, number>();
    for (const [key, qty] of balanceMap) {
      const productId = key.split(":")[0];
      const current = productOnHand.get(productId) ?? 0;
      productOnHand.set(productId, current + qty);
    }
    return Array.from(productOnHand.values()).filter((qty) => qty < threshold).length;
  }
}
