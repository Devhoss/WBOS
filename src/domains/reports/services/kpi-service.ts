import { prisma } from "@/infrastructure/database/prisma";
import { InventoryValuationService } from "@/domains/inventory/services/inventory-valuation-service";
import { StockBalanceService } from "@/domains/inventory/services/stock-balance-service";
import { type KpiCard } from "../dto/report-types";
import { BaseReportRepository } from "../repositories/base-report-repository";

export class KpiService extends BaseReportRepository {
  async salesToday(): Promise<KpiCard> {
    const organizationId = await this.resolveOrganizationId();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await prisma.invoice.aggregate({
      where: {
        organizationId,
        status: { in: ["ISSUED", "PAID", "PARTIALLY_PAID"] },
        issuedAt: { gte: today, lt: tomorrow },
      },
      _sum: { totalAmount: true },
    });

    return {
      label: "Today's Sales",
      value: (this.toNumber(result._sum.totalAmount)).toFixed(3),
      subtitle: "Sales issued today",
    };
  }

  async salesThisMonth(): Promise<KpiCard> {
    const organizationId = await this.resolveOrganizationId();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const result = await prisma.invoice.aggregate({
      where: {
        organizationId,
        status: { in: ["ISSUED", "PAID", "PARTIALLY_PAID"] },
        issuedAt: { gte: monthStart, lt: nextMonth },
      },
      _sum: { totalAmount: true },
    });

    return {
      label: "This Month's Sales",
      value: (this.toNumber(result._sum.totalAmount)).toFixed(3),
      subtitle: "Monthly sales total",
    };
  }

  async outstandingReceivables(): Promise<KpiCard> {
    const organizationId = await this.resolveOrganizationId();

    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId,
        status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
      },
      select: { totalAmount: true, amountPaid: true },
    });

    const total = invoices.reduce(
      (sum, inv) => sum + this.toNumber(inv.totalAmount) - this.toNumber(inv.amountPaid),
      0,
    );

    return {
      label: "Outstanding Receivables",
      value: total.toFixed(3),
      subtitle: `${invoices.length} open invoice(s)`,
    };
  }

  async inventoryValue(): Promise<KpiCard> {
    const organizationId = await this.resolveOrganizationId();

    const totalValue = await new InventoryValuationService().totalValue(organizationId);

    return {
      label: "Inventory Value",
      value: totalValue.toFixed(3),
      subtitle: "Total stock value at average cost",
    };
  }

  async openPurchaseOrders(): Promise<KpiCard> {
    const organizationId = await this.resolveOrganizationId();

    const count = await prisma.purchaseOrder.count({
      where: {
        organizationId,
        status: { in: ["APPROVED", "PARTIALLY_RECEIVED"] },
      },
    });

    return {
      label: "Open Purchase Orders",
      value: count.toString(),
      subtitle: "POs not fully received",
    };
  }

  async openShipments(): Promise<KpiCard> {
    const organizationId = await this.resolveOrganizationId();

    const count = await prisma.shipment.count({
      where: {
        organizationId,
        status: { notIn: ["DELIVERED", "FAILED"] },
      },
    });

    return {
      label: "Open Shipments",
      value: count.toString(),
      subtitle: "Shipments not yet delivered",
    };
  }

  async lowStockItems(threshold = 10): Promise<KpiCard> {
    const organizationId = await this.resolveOrganizationId();

    const balances = await new StockBalanceService().getStockBalancesDetail(organizationId);
    const productOnHand = new Map<string, number>();
    for (const balance of balances) {
      const current = productOnHand.get(balance.productId) ?? 0;
      productOnHand.set(balance.productId, current + Number(balance.onHand));
    }

    const lowCount = Array.from(productOnHand.values()).filter((qty) => qty < threshold).length;

    return {
      label: "Low Stock Items",
      value: lowCount.toString(),
      subtitle: `Products with on-hand < ${threshold}`,
    };
  }

  async customersOverdue(): Promise<KpiCard> {
    const organizationId = await this.resolveOrganizationId();

    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId,
        status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
        dueDate: { lt: new Date() },
      },
      select: { customerId: true },
      distinct: ["customerId"],
    });

    return {
      label: "Customers Overdue",
      value: invoices.length.toString(),
      subtitle: "Customers with overdue invoices",
    };
  }
}
