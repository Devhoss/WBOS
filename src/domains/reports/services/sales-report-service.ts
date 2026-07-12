import { prisma } from "@/infrastructure/database/prisma";
import { BaseReportRepository, type ReportDateRange } from "../repositories/base-report-repository";

type SalesFilters = {
  dateRange?: ReportDateRange;
  customerId?: string | null;
  warehouseId?: string | null;
  search?: string;
};

type SalesByCustomerRow = {
  customerId: string;
  customerName: string;
  totalAmount: number;
  orderCount: number;
};

type SalesByProductRow = {
  productId: string;
  productName: string;
  productSku: string;
  totalQuantity: number;
  totalAmount: number;
  orderCount: number;
};

type SalesByCategoryRow = {
  categoryId: string;
  categoryName: string;
  totalQuantity: number;
  totalAmount: number;
};

type SalesByWarehouseRow = {
  warehouseId: string;
  warehouseName: string;
  totalQuantity: number;
  totalAmount: number;
};

type SalesTrendRow = {
  period: string;
  totalAmount: number;
  orderCount: number;
};

type AverageOrderValueRow = {
  averageOrderValue: number;
  totalOrders: number;
  totalRevenue: number;
};

export class SalesReportService extends BaseReportRepository {
  async byCustomer(filters: SalesFilters): Promise<SalesByCustomerRow[]> {
    const organizationId = await this.resolveOrganizationId();
    const dateFilter = this.buildDateFilter(filters.dateRange);

    const orders = await prisma.salesOrder.findMany({
      where: {
        organizationId,
        status: { in: ["INVOICED", "PAID"] },
        ...(filters.customerId && { customerId: filters.customerId }),
        ...(dateFilter.gte || dateFilter.lte ? { orderedAt: { ...dateFilter } } : {}),
      },
      select: {
        customerId: true,
        totalAmount: true,
        customer: { select: { name: true } },
      },
    });

    const grouped = new Map<string, { customerName: string; totalAmount: number; orderCount: number }>();
    for (const order of orders) {
      const existing = grouped.get(order.customerId);
      const amount = this.toNumber(order.totalAmount);
      if (existing) {
        existing.totalAmount += amount;
        existing.orderCount += 1;
      } else {
        grouped.set(order.customerId, {
          customerName: order.customer.name,
          totalAmount: amount,
          orderCount: 1,
        });
      }
    }

    return Array.from(grouped.entries()).map(([customerId, data]) => ({
      customerId,
      customerName: data.customerName,
      totalAmount: data.totalAmount,
      orderCount: data.orderCount,
    }));
  }

  async byProduct(filters: SalesFilters): Promise<SalesByProductRow[]> {
    const organizationId = await this.resolveOrganizationId();
    const dateFilter = this.buildDateFilter(filters.dateRange);

    const lines = await prisma.salesOrderLine.findMany({
      where: {
        organizationId,
        salesOrder: {
          status: { in: ["INVOICED", "PAID"] },
          ...(dateFilter.gte || dateFilter.lte ? { orderedAt: { ...dateFilter } } : {}),
          ...(filters.customerId && { customerId: filters.customerId }),
        },
      },
      select: {
        productId: true,
        orderedQuantity: true,
        totalPrice: true,
        product: { select: { name: true, sku: true } },
      },
    });

    const grouped = new Map<string, { productName: string; productSku: string; totalQuantity: number; totalAmount: number; orderCount: number }>();
    for (const line of lines) {
      const existing = grouped.get(line.productId);
      const qty = this.toNumber(line.orderedQuantity);
      const amt = this.toNumber(line.totalPrice);
      if (existing) {
        existing.totalQuantity += qty;
        existing.totalAmount += amt;
        existing.orderCount += 1;
      } else {
        grouped.set(line.productId, {
          productName: line.product.name,
          productSku: line.product.sku,
          totalQuantity: qty,
          totalAmount: amt,
          orderCount: 1,
        });
      }
    }

    return Array.from(grouped.entries()).map(([productId, data]) => ({
      productId,
      productName: data.productName,
      productSku: data.productSku,
      totalQuantity: data.totalQuantity,
      totalAmount: data.totalAmount,
      orderCount: data.orderCount,
    }));
  }

  async byCategory(filters: SalesFilters): Promise<SalesByCategoryRow[]> {
    const organizationId = await this.resolveOrganizationId();
    const dateFilter = this.buildDateFilter(filters.dateRange);

    const lines = await prisma.salesOrderLine.findMany({
      where: {
        organizationId,
        salesOrder: {
          status: { in: ["INVOICED", "PAID"] },
          ...(dateFilter.gte || dateFilter.lte ? { orderedAt: { ...dateFilter } } : {}),
          ...(filters.customerId && { customerId: filters.customerId }),
        },
      },
      select: {
        orderedQuantity: true,
        totalPrice: true,
        product: {
          select: {
            categoryId: true,
            category: { select: { name: true } },
          },
        },
      },
    });

    const grouped = new Map<string, { categoryName: string; totalQuantity: number; totalAmount: number }>();
    for (const line of lines) {
      const catId = line.product.categoryId;
      const existing = grouped.get(catId);
      const qty = this.toNumber(line.orderedQuantity);
      const amt = this.toNumber(line.totalPrice);
      if (existing) {
        existing.totalQuantity += qty;
        existing.totalAmount += amt;
      } else {
        grouped.set(catId, {
          categoryName: line.product.category.name,
          totalQuantity: qty,
          totalAmount: amt,
        });
      }
    }

    return Array.from(grouped.entries()).map(([categoryId, data]) => ({
      categoryId,
      categoryName: data.categoryName,
      totalQuantity: data.totalQuantity,
      totalAmount: data.totalAmount,
    }));
  }

  async byWarehouse(filters: SalesFilters): Promise<SalesByWarehouseRow[]> {
    const organizationId = await this.resolveOrganizationId();
    const dateFilter = this.buildDateFilter(filters.dateRange);

    const lines = await prisma.shipmentLine.findMany({
      where: {
        organizationId,
        shipment: {
          ...(dateFilter.gte || dateFilter.lte ? { createdAt: { ...dateFilter } } : {}),
          ...(filters.warehouseId && { warehouseId: filters.warehouseId }),
        },
      },
      select: {
        quantity: true,
        shipment: {
          select: {
            warehouseId: true,
            warehouse: { select: { name: true } },
          },
        },
        salesOrderLine: {
          select: {
            totalPrice: true,
          },
        },
      },
    });

    const grouped = new Map<string, { warehouseName: string; totalQuantity: number; totalAmount: number }>();
    for (const line of lines) {
      const whId = line.shipment.warehouseId;
      const existing = grouped.get(whId);
      const qty = this.toNumber(line.quantity);
      const amt = this.toNumber(line.salesOrderLine?.totalPrice ?? 0);
      if (existing) {
        existing.totalQuantity += qty;
        existing.totalAmount += amt;
      } else {
        grouped.set(whId, {
          warehouseName: line.shipment.warehouse.name,
          totalQuantity: qty,
          totalAmount: amt,
        });
      }
    }

    return Array.from(grouped.entries()).map(([warehouseId, data]) => ({
      warehouseId,
      warehouseName: data.warehouseName,
      totalQuantity: data.totalQuantity,
      totalAmount: data.totalAmount,
    }));
  }

  async trend(filters: SalesFilters): Promise<SalesTrendRow[]> {
    const organizationId = await this.resolveOrganizationId();
    const dateFilter = this.buildDateFilter(filters.dateRange);

    const orders = await prisma.salesOrder.findMany({
      where: {
        organizationId,
        status: { in: ["INVOICED", "PAID"] },
        ...(dateFilter.gte || dateFilter.lte ? { orderedAt: { ...dateFilter } } : {}),
        ...(filters.customerId && { customerId: filters.customerId }),
      },
      select: {
        orderedAt: true,
        totalAmount: true,
      },
      orderBy: { orderedAt: "asc" },
    });

    const grouped = new Map<string, { totalAmount: number; orderCount: number }>();
    for (const order of orders) {
      const period = order.orderedAt.toISOString().slice(0, 10);
      const existing = grouped.get(period);
      const amt = this.toNumber(order.totalAmount);
      if (existing) {
        existing.totalAmount += amt;
        existing.orderCount += 1;
      } else {
        grouped.set(period, { totalAmount: amt, orderCount: 1 });
      }
    }

    return Array.from(grouped.entries()).map(([period, data]) => ({
      period,
      totalAmount: data.totalAmount,
      orderCount: data.orderCount,
    }));
  }

  async topProducts(filters: SalesFilters, limit = 10): Promise<SalesByProductRow[]> {
    const rows = await this.byProduct(filters);
    return rows.sort((a, b) => b.totalAmount - a.totalAmount).slice(0, limit);
  }

  async topCustomers(filters: SalesFilters, limit = 10): Promise<SalesByCustomerRow[]> {
    const rows = await this.byCustomer(filters);
    return rows.sort((a, b) => b.totalAmount - a.totalAmount).slice(0, limit);
  }

  async averageOrderValue(filters: SalesFilters): Promise<AverageOrderValueRow> {
    const organizationId = await this.resolveOrganizationId();
    const dateFilter = this.buildDateFilter(filters.dateRange);

    const result = await prisma.salesOrder.aggregate({
      where: {
        organizationId,
        status: { in: ["INVOICED", "PAID"] },
        ...(dateFilter.gte || dateFilter.lte ? { orderedAt: { ...dateFilter } } : {}),
        ...(filters.customerId && { customerId: filters.customerId }),
      },
      _sum: { totalAmount: true },
      _count: true,
    });

    const totalRevenue = this.toNumber(result._sum.totalAmount);
    const totalOrders = result._count;

    return {
      averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      totalOrders,
      totalRevenue,
    };
  }
}
