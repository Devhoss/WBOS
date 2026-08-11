import { prisma } from "@/infrastructure/database/prisma";
import { InventoryValuationService } from "@/domains/inventory/services/inventory-valuation-service";

/* ── Types ───────────────────────────────────────────────────────────────── */

export type TrendPoint = { label: string; value: number };
export type TopItem = { name: string; value: number };

export type ProfitabilitySummary = {
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  grossMarginPercent: number;
  revenueTrend: TrendPoint[];
  topProducts: TopItem[];
};

export type ReceivablesSummary = {
  totalOutstanding: number;
  overdueCount: number;
  aging: {
    current: number;
    days1to30: number;
    days31to60: number;
    days61to90: number;
    days91plus: number;
  };
  topOverdueCustomers: {
    name: string;
    totalOutstanding: number;
    current: number;
    days1to30: number;
    days31to60: number;
    days61to90: number;
    days91plus: number;
  }[];
};

export type InventorySummary = {
  totalValue: number;
  lowStockCount: number;
  slowMovingCount: number;
  aging: {
    bucket0to30: number;
    bucket31to60: number;
    bucket61to90: number;
    bucket91plus: number;
  };
  topSlowMoving: {
    name: string;
    onHand: number;
    movementInPeriod: number;
  }[];
};

export type PurchasingSummary = {
  totalSpend: number;
  openPoCount: number;
  outstandingValue: number;
  topSuppliers: { name: string; totalAmount: number }[];
  openPos: {
    poNumber: string;
    supplierName: string;
    totalAmount: number;
    outstandingValue: number;
    status: string;
    expectedDeliveryDate: string | null;
  }[];
};

export type SalesContextSummary = {
  averageOrderValue: number;
  totalOrders: number;
  totalRevenue: number;
  topCustomers: { name: string; value: number }[];
};

export type ExecutiveSummary = {
  profitability: ProfitabilitySummary;
  receivables: ReceivablesSummary;
  inventory: InventorySummary;
  purchasing: PurchasingSummary;
  salesContext: SalesContextSummary;
};

/* ── Service ─────────────────────────────────────────────────────────────── */

export class ExecutiveService {
  async getSummary(organizationId: string): Promise<ExecutiveSummary> {
    const [
      profitability,
      receivables,
      inventory,
      purchasing,
      salesContext,
    ] = await Promise.all([
      this.getProfitability(organizationId),
      this.getReceivables(organizationId),
      this.getInventory(organizationId),
      this.getPurchasing(organizationId),
      this.getSalesContext(organizationId),
    ]);

    return { profitability, receivables, inventory, purchasing, salesContext };
  }

  /* ── Panel 1: Revenue & Profitability ─────────────────────────────────── */

  private async getProfitability(organizationId: string): Promise<ProfitabilitySummary> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    const monthStart = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth(), 1);

    // Revenue COGS via inventory ledger (same filter as InventoryReportService.cogs)
    const [revenueResult, cogsResult, trendRows, topProductRows] = await Promise.all([
      prisma.invoice.aggregate({
        where: {
          organizationId,
          status: { in: ["ISSUED", "PAID"] },
        },
        _sum: { totalAmount: true },
      }),
      prisma.inventoryLedgerEntry.aggregate({
        where: {
          organizationId,
          direction: "OUT",
          unitCost: { not: null },
        },
        _sum: { totalCost: true },
      }),
      prisma.$queryRaw<{ month: Date; total: unknown }[]>`
        SELECT DATE_TRUNC('month', "issuedAt") AS "month", SUM("totalAmount") AS "total"
        FROM invoices
        WHERE "organizationId" = ${organizationId}
          AND "status" IN ('ISSUED', 'PAID')
          AND "issuedAt" >= ${monthStart}
        GROUP BY DATE_TRUNC('month', "issuedAt")
        ORDER BY "month" ASC
      `,
      prisma.invoiceLine.groupBy({
        by: ["productId"],
        where: {
          invoice: { organizationId, status: { in: ["ISSUED", "PAID"] } },
        },
        _sum: { totalPrice: true },
        orderBy: { _sum: { totalPrice: "desc" } },
        take: 5,
      }),
    ]);

    const totalRevenue = Number(revenueResult._sum.totalAmount ?? 0);
    const totalCogs = Number(cogsResult._sum.totalCost ?? 0);
    const grossProfit = totalRevenue - totalCogs;
    const grossMarginPercent = totalRevenue > 0
      ? Math.round((grossProfit / totalRevenue) * 10000) / 100
      : 0;

    // Build 6-month trend (same logic as DashboardService.getSalesTrend)
    const byMonth = new Map<string, number>();
    for (const row of trendRows) {
      const key = new Date(row.month).toISOString().slice(0, 7);
      byMonth.set(key, Number(row.total ?? 0));
    }
    const revenueTrend: TrendPoint[] = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const key = d.toISOString().slice(0, 7);
      return {
        label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        value: byMonth.get(key) ?? 0,
      };
    });

    // Top products by revenue
    const productIds = topProductRows.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(products.map((p) => [p.id, p.name]));
    const topProducts: TopItem[] = topProductRows.map((item) => ({
      name: nameMap.get(item.productId) ?? "Unknown",
      value: Number(item._sum.totalPrice ?? 0),
    }));

    return { totalRevenue, totalCogs, grossProfit, grossMarginPercent, revenueTrend, topProducts };
  }

  /* ── Panel 2: Receivables ─────────────────────────────────────────────── */

  private async getReceivables(organizationId: string): Promise<ReceivablesSummary> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId,
        status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
      },
      select: {
        customerId: true,
        totalAmount: true,
        amountPaid: true,
        dueDate: true,
        customer: { select: { name: true } },
      },
    });

    // Aggregate aging buckets (same logic as FinancialReportService.arAging)
    const grouped = new Map<string, {
      customerName: string;
      totalInvoiced: number;
      totalPaid: number;
      buckets: { current: number; d1to30: number; d31to60: number; d61to90: number; d91plus: number };
    }>();

    for (const inv of invoices) {
      const outstanding = Number(inv.totalAmount) - Number(inv.amountPaid);
      if (outstanding <= 0) continue;

      const existing = grouped.get(inv.customerId) ?? {
        customerName: inv.customer.name,
        totalInvoiced: 0,
        totalPaid: 0,
        buckets: { current: 0, d1to30: 0, d31to60: 0, d61to90: 0, d91plus: 0 },
      };

      existing.totalInvoiced += Number(inv.totalAmount);
      existing.totalPaid += Number(inv.amountPaid);

      if (!inv.dueDate || inv.dueDate >= today) {
        existing.buckets.current += outstanding;
      } else {
        const daysOverdue = Math.round((today.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysOverdue <= 30) existing.buckets.d1to30 += outstanding;
        else if (daysOverdue <= 60) existing.buckets.d31to60 += outstanding;
        else if (daysOverdue <= 90) existing.buckets.d61to90 += outstanding;
        else existing.buckets.d91plus += outstanding;
      }

      grouped.set(inv.customerId, existing);
    }

    let totalOutstanding = 0;
    let overdueCount = 0;
    const aging = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days91plus: 0 };

    const entries = Array.from(grouped.entries());
    const customerRows = entries.map(([, data]) => {
      const custOutstanding = data.totalInvoiced - data.totalPaid;
      totalOutstanding += custOutstanding;
      const hasOverdue = data.buckets.d1to30 + data.buckets.d31to60 + data.buckets.d61to90 + data.buckets.d91plus > 0;
      if (hasOverdue) overdueCount++;
      aging.current += data.buckets.current;
      aging.days1to30 += data.buckets.d1to30;
      aging.days31to60 += data.buckets.d31to60;
      aging.days61to90 += data.buckets.d61to90;
      aging.days91plus += data.buckets.d91plus;
      return {
        name: data.customerName,
        totalOutstanding: custOutstanding,
        current: data.buckets.current,
        days1to30: data.buckets.d1to30,
        days31to60: data.buckets.d31to60,
        days61to90: data.buckets.d61to90,
        days91plus: data.buckets.d91plus,
      };
    });

    const topOverdueCustomers = customerRows
      .filter((c) => c.days1to30 + c.days31to60 + c.days61to90 + c.days91plus > 0)
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding)
      .slice(0, 10);

    return { totalOutstanding, overdueCount, aging, topOverdueCustomers };
  }

  /* ── Panel 3: Inventory ───────────────────────────────────────────────── */

  private async getInventory(organizationId: string): Promise<InventorySummary> {
    const [
      totalValue,
      lowStockCount,
      agingEntries,
      slowMovingProducts,
    ] = await Promise.all([
      new InventoryValuationService().totalValue(organizationId),
      this._countLowStock(organizationId),
      this._getInventoryAging(organizationId),
      this._getSlowMoving(organizationId),
    ]);

    // Group aging entries into day-range buckets
    const aging = { bucket0to30: 0, bucket31to60: 0, bucket61to90: 0, bucket91plus: 0 };
    for (const entry of agingEntries) {
      if (entry.daysSinceLastMovement <= 30) aging.bucket0to30++;
      else if (entry.daysSinceLastMovement <= 60) aging.bucket31to60++;
      else if (entry.daysSinceLastMovement <= 90) aging.bucket61to90++;
      else aging.bucket91plus++;
    }

    return {
      totalValue,
      lowStockCount,
      slowMovingCount: slowMovingProducts.length,
      aging,
      topSlowMoving: slowMovingProducts,
    };
  }

  private async _countLowStock(organizationId: string): Promise<number> {
    const settings = await prisma.businessSettings.findUnique({
      where: { organizationId },
      select: { lowStockThreshold: true },
    });
    const threshold = settings?.lowStockThreshold ?? 10;

    const rows = await prisma.productCost.groupBy({
      by: ["productId"],
      where: { organizationId, totalQuantity: { gt: 0 } },
      _sum: { totalQuantity: true },
      having: { totalQuantity: { _sum: { lt: threshold } } },
    });
    return rows.length;
  }

  private async _getInventoryAging(organizationId: string) {
    const now = new Date();

    const entries = await prisma.inventoryLedgerEntry.groupBy({
      by: ["productId", "warehouseId", "direction"],
      where: { organizationId },
      _sum: { quantity: true },
      _max: { occurredAt: true },
    });

    const productIds = [...new Set(entries.map((e) => e.productId))];
    const warehouseIds = [...new Set(entries.map((e) => e.warehouseId))];

    const [products, warehouses] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true },
      }),
      prisma.warehouse.findMany({
        where: { id: { in: warehouseIds } },
        select: { id: true, name: true },
      }),
    ]);

    const productMap = new Map(products.map((p) => [p.id, p.name]));
    const warehouseMap = new Map(warehouses.map((w) => [w.id, w.name]));
    const balanceMap = new Map<string, { onHand: number; lastMovement: Date | null }>();

    for (const entry of entries) {
      const key = `${entry.productId}:${entry.warehouseId}`;
      const qty = Number(entry._sum.quantity ?? 0);
      const current = balanceMap.get(key) ?? { onHand: 0, lastMovement: null };
      const newQty = entry.direction === "IN" ? current.onHand + qty : current.onHand - qty;
      const last = entry._max.occurredAt;
      balanceMap.set(key, {
        onHand: newQty,
        lastMovement: last && (!current.lastMovement || last > current.lastMovement) ? last : current.lastMovement,
      });
    }

    return Array.from(balanceMap.entries())
      .filter(([, data]) => data.onHand !== 0)
      .map(([key, data]) => {
        const [productId, wid] = key.split(":");
        return {
          productName: productMap.get(productId) ?? "Unknown",
          warehouseName: warehouseMap.get(wid) ?? "Unknown",
          onHand: data.onHand,
          daysSinceLastMovement: data.lastMovement
            ? Math.round((now.getTime() - data.lastMovement.getTime()) / (1000 * 60 * 60 * 24))
            : 999,
        };
      });
  }

  private async _getSlowMoving(organizationId: string, days = 90) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    // Get current stock from product_cost
    const stockRows = await prisma.productCost.groupBy({
      by: ["productId"],
      where: { organizationId, totalQuantity: { gt: 0 } },
      _sum: { totalQuantity: true },
    });

    const productIds = stockRows.map((r) => r.productId);
    if (productIds.length === 0) return [];

    const [products, recentLines] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true },
      }),
      prisma.inventoryTransactionLine.findMany({
        where: {
          organizationId,
          productId: { in: productIds },
          transaction: { occurredAt: { gte: cutoff }, status: "POSTED" },
        },
        select: { productId: true, quantity: true },
      }),
    ]);

    const nameMap = new Map(products.map((p) => [p.id, p.name]));
    const movementMap = new Map<string, number>();
    for (const line of recentLines) {
      movementMap.set(line.productId, (movementMap.get(line.productId) ?? 0) + Number(line.quantity));
    }

    return stockRows
      .filter((row) => (movementMap.get(row.productId) ?? 0) === 0)
      .map((row) => ({
        name: nameMap.get(row.productId) ?? "Unknown",
        onHand: Number(row._sum.totalQuantity ?? 0),
        movementInPeriod: movementMap.get(row.productId) ?? 0,
      }))
      .sort((a, b) => b.onHand - a.onHand)
      .slice(0, 10);
  }

  /* ── Panel 4: Purchasing ──────────────────────────────────────────────── */

  private async getPurchasing(organizationId: string): Promise<PurchasingSummary> {
    const [bySupplier, outstandingOrders] = await Promise.all([
      // Same logic as PurchasingReportService.bySupplier
      prisma.purchaseOrder.findMany({
        where: {
          organizationId,
          status: { notIn: ["DRAFT", "CANCELLED"] },
        },
        select: {
          supplierId: true,
          totalAmount: true,
          supplier: { select: { name: true } },
        },
      }),
      // Same logic as PurchasingReportService.outstandingOrders
      prisma.purchaseOrder.findMany({
        where: {
          organizationId,
          status: { in: ["APPROVED", "PARTIALLY_RECEIVED"] },
        },
        select: {
          poNumber: true,
          totalAmount: true,
          status: true,
          expectedDeliveryDate: true,
          supplier: { select: { name: true } },
          lines: { select: { receivedQuantity: true, totalCost: true, orderedQuantity: true } },
        },
        orderBy: { expectedDeliveryDate: "asc" },
      }),
    ]);

    // Aggregate by supplier
    const supplierMap = new Map<string, { name: string; totalAmount: number }>();
    for (const order of bySupplier) {
      const existing = supplierMap.get(order.supplierId);
      const amt = Number(order.totalAmount);
      if (existing) {
        existing.totalAmount += amt;
      } else {
        supplierMap.set(order.supplierId, { name: order.supplier.name, totalAmount: amt });
      }
    }
    const topSuppliers = Array.from(supplierMap.values())
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5);

    const totalSpend = topSuppliers.reduce((sum, s) => sum + s.totalAmount, 0)
      + Array.from(supplierMap.values()).slice(5).reduce((sum, s) => sum + s.totalAmount, 0);

    // Process outstanding orders
    let outstandingValue = 0;
    const openPos = outstandingOrders.map((po) => {
      const receivedValue = po.lines.reduce(
        (sum, line) => sum + Number(line.receivedQuantity) * (Number(line.totalCost) / Math.max(Number(line.receivedQuantity), 1)),
        0,
      );
      const poOutstanding = Number(po.totalAmount) - receivedValue;
      outstandingValue += poOutstanding;
      return {
        poNumber: po.poNumber,
        supplierName: po.supplier.name,
        totalAmount: Number(po.totalAmount),
        outstandingValue: poOutstanding,
        status: po.status,
        expectedDeliveryDate: po.expectedDeliveryDate?.toISOString() ?? null,
      };
    });

    return {
      totalSpend,
      openPoCount: outstandingOrders.length,
      outstandingValue,
      topSuppliers,
      openPos,
    };
  }

  /* ── Panel 5: Sales Context ───────────────────────────────────────────── */

  private async getSalesContext(organizationId: string): Promise<SalesContextSummary> {
    const [avgOrderResult, topCustomerRows] = await Promise.all([
      // Same logic as SalesReportService.averageOrderValue
      prisma.salesOrder.aggregate({
        where: {
          organizationId,
          status: { in: ["INVOICED", "PAID"] },
        },
        _sum: { totalAmount: true },
        _count: true,
      }),
      // Same logic as DashboardService.getTopCustomers
      prisma.invoice.groupBy({
        by: ["customerId"],
        where: { organizationId, status: { in: ["ISSUED", "PAID", "PARTIALLY_PAID"] } },
        _sum: { totalAmount: true },
        orderBy: { _sum: { totalAmount: "desc" } },
        take: 10,
      }),
    ]);

    const totalRevenue = Number(avgOrderResult._sum.totalAmount ?? 0);
    const totalOrders = avgOrderResult._count;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const customerIds = topCustomerRows.map((i) => i.customerId).filter(Boolean) as string[];
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(customers.map((c) => [c.id, c.name]));
    const topCustomers: TopItem[] = topCustomerRows.map((inv) => ({
      name: nameMap.get(inv.customerId!) ?? "Unknown",
      value: Number(inv._sum.totalAmount ?? 0),
    }));

    return { averageOrderValue, totalOrders, totalRevenue, topCustomers };
  }
}
