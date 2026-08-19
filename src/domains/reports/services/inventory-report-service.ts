import { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";
import {
  REVENUE_INVOICE_STATUSES,
  REVENUE_REDUCING_CREDIT_NOTE_STATUSES,
} from "../revenue-recognition";
import {
  CLASSIFICATION_LABELS,
  classifyLedgerEntry,
  cogsImpact,
  cogsLedgerWhere,
  writeOffLedgerWhere,
  type LedgerClassification,
} from "../cogs-classification";
import { InventoryValuationService, type InventoryValuationRow } from "@/domains/inventory/services/inventory-valuation-service";
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
  reservedQuantity: number;
  availableQuantity: number;
  unitCost: number | null;
};

type ValuationRow = InventoryValuationRow;

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

type ProductCostHistoryRow = {
  occurredAt: Date;
  movementType: string;
  direction: string;
  documentNumber: string | null;
  quantity: number;
  unitCost: number | null;
  totalCost: number | null;
};

type CogsRow = {
  occurredAt: Date;
  documentNumber: string | null;
  movementType: string;
  classification: string;
  productName: string;
  productSku: string;
  warehouseName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  /** Signed contribution to COGS: positive for a sale, negative for a return. */
  costImpact: number;
};

type WriteOffRow = {
  occurredAt: Date;
  documentNumber: string | null;
  movementType: string;
  productName: string;
  productSku: string;
  warehouseName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
};

type GrossProfitRow = {
  invoiceNumber: string;
  issuedAt: Date | null;
  customerName: string;
  productName: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  marginPercent: number;
};

type CostCardHeader = {
  productName: string;
  productSku: string;
  warehouseName: string;
  averageCost: number;
  totalQuantity: number;
  totalValue: number;
};

type CostCardRow = {
  occurredAt: Date;
  movementType: string;
  direction: string;
  documentNumber: string | null;
  quantity: number;
  unitCost: number | null;
  totalCost: number | null;
  runningQuantity: number;
  runningValue: number;
  runningAvg: number;
};

type CostCardData = {
  header: CostCardHeader;
  entries: CostCardRow[];
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

    if (entries.length === 0) return [];

    const productIds = [...new Set(entries.map((e) => e.productId))];
    const warehouseIds = [...new Set(entries.map((e) => e.warehouseId))];

    const [products, warehouses, shipmentLines, latestCosts] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, sku: true },
      }),
      prisma.warehouse.findMany({
        where: { id: { in: warehouseIds } },
        select: { id: true, name: true },
      }),
      prisma.shipmentLine.findMany({
        where: {
          organizationId,
          productId: { in: productIds },
          shipment: {
            status: { in: ["PENDING_PICK", "PICKING", "PICKED", "LOADED", "OUT_FOR_DELIVERY"] },
          },
        },
        select: {
          productId: true,
          quantity: true,
          pickedQuantity: true,
          shipmentId: true,
          shipment: { select: { warehouseId: true } },
        },
      }),
      // Latest purchase cost per product
      prisma.purchaseOrderLine.findMany({
        where: {
          organizationId,
          productId: { in: productIds },
          purchaseOrder: { status: { not: "CANCELLED" } },
        },
        orderBy: { purchaseOrder: { orderedAt: "desc" } },
        select: { productId: true, unitCost: true },
      }),
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));
    const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));

    // Compute on-hand balance per product+warehouse
    const balanceMap = new Map<string, number>();
    for (const entry of entries) {
      const key = `${entry.productId}:${entry.warehouseId}`;
      const qty = this.toNumber(entry._sum.quantity);
      const current = balanceMap.get(key) ?? 0;
      balanceMap.set(key, entry.direction === "IN" ? current + qty : current - qty);
    }

    // Compute reserved quantity per product+warehouse from non-delivered shipments
    const reservedMap = new Map<string, number>();
    for (const line of shipmentLines) {
      const whId = line.shipment.warehouseId;
      const key = `${line.productId}:${whId}`;
      const reserved = this.toNumber(line.quantity) - this.toNumber(line.pickedQuantity);
      if (reserved > 0) {
        reservedMap.set(key, (reservedMap.get(key) ?? 0) + reserved);
      }
    }

    // Latest unit cost per product (most recent purchase order)
    const costMap = new Map<string, number | null>();
    for (const line of latestCosts) {
      if (!costMap.has(line.productId)) {
        costMap.set(line.productId, this.toNumber(line.unitCost));
      }
    }

    return Array.from(balanceMap.entries())
      .filter(([_, qty]) => qty !== 0)
      .map(([key, onHand]) => {
        const [productId, wid] = key.split(":");
        const product = productMap.get(productId);
        const warehouse = warehouseMap.get(wid);
        const reservedQuantity = reservedMap.get(key) ?? 0;
        return {
          productId,
          productName: product?.name ?? "Unknown",
          productSku: product?.sku ?? "",
          warehouseId: wid,
          warehouseName: warehouse?.name ?? "Unknown",
          onHand,
          reservedQuantity,
          availableQuantity: onHand - reservedQuantity,
          unitCost: costMap.get(productId) ?? null,
        };
      });
  }

  async valuation(filters: InventoryFilters): Promise<ValuationRow[]> {
    const organizationId = await this.resolveOrganizationId();
    return new InventoryValuationService().valuation(organizationId, {
      warehouseId: filters.warehouseId,
      search: filters.search,
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

  async productCostHistory(filters: InventoryFilters & { productId: string; warehouseId?: string | null }): Promise<ProductCostHistoryRow[]> {
    const organizationId = await this.resolveOrganizationId();
    const whId = filters.warehouseId;

    const entries = await prisma.inventoryLedgerEntry.findMany({
      where: {
        organizationId,
        productId: filters.productId,
        ...(whId && { warehouseId: whId }),
        unitCost: { not: null },
      },
      include: {
        transaction: { select: { documentNumber: true, type: true } },
      },
      orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
    });

    return entries.map((e) => ({
      occurredAt: e.occurredAt,
      movementType: e.movementType,
      direction: e.direction,
      documentNumber: e.transaction.documentNumber,
      quantity: this.toNumber(e.quantity),
      unitCost: this.toNumber(e.unitCost),
      totalCost: this.toNumber(e.totalCost),
    }));
  }

  /** Shared filter fragment so every ledger-backed report scopes identically. */
  private ledgerScope(filters: InventoryFilters) {
    const dateFilter = this.buildDateFilter(filters.dateRange);
    const whId = filters.warehouseId;
    return {
      unitCost: { not: null },
      ...(whId && { warehouseId: whId }),
      ...(dateFilter.gte || dateFilter.lte ? { occurredAt: { ...dateFilter } } : {}),
      ...(filters.search && {
        product: {
          OR: [
            { name: { contains: filters.search, mode: "insensitive" as const } },
            { sku: { contains: filters.search, mode: "insensitive" as const } },
          ],
        },
      }),
    };
  }

  /**
   * Cost of goods sold.
   *
   * This used to list EVERY costed outbound movement, which meant internal
   * warehouse transfers, cycle-count shrinkage and damaged stock all appeared
   * as cost of sales. It now uses the same canonical classification as the
   * gross-profit report and the executive panel, so the three cannot drift:
   * sales count, customer returns count against them, write-offs and transfers
   * appear on neither.
   */
  async cogs(filters: InventoryFilters): Promise<CogsRow[]> {
    const organizationId = await this.resolveOrganizationId();

    const entries = await prisma.inventoryLedgerEntry.findMany({
      where: { organizationId, ...this.ledgerScope(filters), ...cogsLedgerWhere },
      include: {
        product: { select: { name: true, sku: true } },
        warehouse: { select: { name: true } },
        transaction: { select: { documentNumber: true } },
      },
      orderBy: { occurredAt: "desc" },
    });

    return entries.map((e) => {
      const classification: LedgerClassification = classifyLedgerEntry(e.movementType, e.direction);
      const totalCost = this.toNumber(e.totalCost);
      return {
        occurredAt: e.occurredAt,
        documentNumber: e.transaction.documentNumber,
        movementType: e.movementType,
        classification: CLASSIFICATION_LABELS[classification],
        productName: e.product.name,
        productSku: e.product.sku,
        warehouseName: e.warehouse.name,
        quantity: this.toNumber(e.quantity),
        unitCost: this.toNumber(e.unitCost),
        totalCost,
        costImpact: cogsImpact(classification, totalCost),
      };
    });
  }

  /**
   * Inventory written off: damaged, expired, or lost to a cycle count.
   *
   * A real cost, but not the cost of anything sold, so it is reported here
   * rather than inside gross profit.
   */
  async writeOffs(filters: InventoryFilters): Promise<WriteOffRow[]> {
    const organizationId = await this.resolveOrganizationId();

    const entries = await prisma.inventoryLedgerEntry.findMany({
      where: { organizationId, ...this.ledgerScope(filters), ...writeOffLedgerWhere },
      include: {
        product: { select: { name: true, sku: true } },
        warehouse: { select: { name: true } },
        transaction: { select: { documentNumber: true } },
      },
      orderBy: { occurredAt: "desc" },
    });

    return entries.map((e) => ({
      occurredAt: e.occurredAt,
      documentNumber: e.transaction.documentNumber,
      movementType: e.movementType,
      productName: e.product.name,
      productSku: e.product.sku,
      warehouseName: e.warehouse.name,
      quantity: this.toNumber(e.quantity),
      unitCost: this.toNumber(e.unitCost),
      totalCost: this.toNumber(e.totalCost),
    }));
  }

  async grossProfit(filters: InventoryFilters): Promise<GrossProfitRow[]> {
    const organizationId = await this.resolveOrganizationId();
    const dateFilter = this.buildDateFilter(filters.dateRange);

    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId,
        // A sale is a sale regardless of how much of it has been collected.
        status: { in: [...REVENUE_INVOICE_STATUSES] },
        ...(dateFilter.gte || dateFilter.lte ? { issuedAt: { ...dateFilter } } : {}),
      },
      select: {
        id: true,
        invoiceNumber: true,
        issuedAt: true,
        customerName: true,
      },
      orderBy: { issuedAt: "desc" },
    });

    if (invoices.length === 0) return [];

    const invoiceIds = invoices.map((i) => i.id);

    const invoiceLines = await prisma.invoiceLine.findMany({
      where: { invoiceId: { in: invoiceIds } },
      select: {
        id: true,
        invoiceId: true,
        salesOrderLineId: true,
        productName: true,
        totalPrice: true,
      },
    });

    /**
     * Credits are attributed to the exact invoice line they were raised
     * against — credit note lines carry `invoiceLineId` — so a credit against a
     * paid line never lands on a duplicate free-sample line for the same
     * product. Only ISSUED credit notes count: a cancelled one has already
     * released its claim on the invoice.
     */
    const creditLines = await prisma.creditNoteLine.groupBy({
      by: ["invoiceLineId"],
      where: {
        organizationId,
        invoiceLineId: { in: invoiceLines.map((il) => il.id) },
        creditNote: { status: { in: [...REVENUE_REDUCING_CREDIT_NOTE_STATUSES] } },
      },
      _sum: { totalPrice: true },
    });

    const creditByInvoiceLine = new Map(
      creditLines.map((c) => [c.invoiceLineId, this.toNumber(c._sum.totalPrice)]),
    );

    const soLineIds = [...new Set(invoiceLines.map((il) => il.salesOrderLineId))];

    const shipmentLines = await prisma.shipmentLine.findMany({
      where: { salesOrderLineId: { in: soLineIds } },
      select: { id: true, salesOrderLineId: true, shipmentId: true },
      orderBy: { id: "asc" },
    });

    /**
     * ALL shipment lines for each sales-order line, not just one.
     *
     * This was `new Map(shipmentLines.map((sl) => [sl.salesOrderLineId, sl]))`.
     * A Map keeps the LAST entry for a repeated key, and an order line
     * fulfilled across several despatches legitimately has one shipment line
     * per consignment — so every consignment but the last was dropped from
     * COGS. The error understated cost and therefore OVERSTATED gross profit,
     * which is the direction that does not look wrong on the report.
     *
     * Only one active invoice may exist per sales order, so pooling every
     * consignment onto that order line's invoice line cannot double-count.
     */
    const soLineToShipmentLines = new Map<string, typeof shipmentLines>();
    for (const sl of shipmentLines) {
      const arr = soLineToShipmentLines.get(sl.salesOrderLineId) ?? [];
      arr.push(sl);
      soLineToShipmentLines.set(sl.salesOrderLineId, arr);
    }

    const shipmentIds = [...new Set(shipmentLines.map((sl) => sl.shipmentId))];

    const shipmentLinesByShipment = new Map<string, typeof shipmentLines>();
    for (const sl of shipmentLines) {
      const arr = shipmentLinesByShipment.get(sl.shipmentId) ?? [];
      arr.push(sl);
      shipmentLinesByShipment.set(sl.shipmentId, arr);
    }

    const transactions = await prisma.inventoryTransaction.findMany({
      where: {
        organizationId,
        type: "SALE",
        referenceType: "SHIPMENT",
        referenceId: { in: shipmentIds },
      },
      select: { id: true, referenceId: true },
    });

    const txMap = new Map(transactions.map((t) => [t.referenceId!, t.id]));
    const txIds = transactions.map((t) => t.id);

    const txLines = await prisma.inventoryTransactionLine.findMany({
      where: { transactionId: { in: txIds } },
      orderBy: [{ transactionId: "asc" }, { createdAt: "asc" }],
      select: { id: true, transactionId: true },
    });

    const txLinesByTx = new Map<string, typeof txLines>();
    for (const tl of txLines) {
      const arr = txLinesByTx.get(tl.transactionId) ?? [];
      arr.push(tl);
      txLinesByTx.set(tl.transactionId, arr);
    }

    const txLineIds = txLines.map((tl) => tl.id);

    const ledgerEntries = await prisma.inventoryLedgerEntry.findMany({
      where: {
        transactionLineId: { in: txLineIds },
        movementType: "SALE",
        direction: "OUT",
      },
      select: { transactionLineId: true, totalCost: true },
    });

    const costByTxLine = new Map(ledgerEntries.map((le) => [le.transactionLineId, this.toNumber(le.totalCost)]));

    /**
     * Cost taken back out of COGS by customer returns, per invoice line.
     *
     * Return postings reference the exact ReturnOrderLine, and that line knows
     * which invoice line it came from — so a return against a paid line is
     * never attributed to a duplicate FREE_SAMPLE line for the same product.
     *
     * Both dispositions land here. A restock returns the goods to sellable
     * stock; a scrap does not, but in both cases the original sale's cost has
     * stopped being the cost of a completed sale. For a scrap the same amount
     * reappears as a write-off, which is reported separately.
     */
    const returnLines = await prisma.returnOrderLine.findMany({
      where: {
        organizationId,
        invoiceLineId: { in: invoiceLines.map((il) => il.id) },
      },
      select: { id: true, invoiceLineId: true },
    });

    const returnedCostByInvoiceLine = new Map<string, number>();

    if (returnLines.length > 0) {
      const returnCredits = await prisma.inventoryLedgerEntry.groupBy({
        by: ["transactionId"],
        where: {
          organizationId,
          direction: "IN",
          movementType: "CUSTOMER_RETURN",
          transaction: {
            referenceType: "ReturnOrderLine",
            referenceId: { in: returnLines.map((rl) => rl.id) },
          },
        },
        _sum: { totalCost: true },
      });

      if (returnCredits.length > 0) {
        const transactions = await prisma.inventoryTransaction.findMany({
          where: { id: { in: returnCredits.map((rc) => rc.transactionId) } },
          select: { id: true, referenceId: true },
        });
        const returnLineByTransaction = new Map(transactions.map((t) => [t.id, t.referenceId]));
        const invoiceLineByReturnLine = new Map(
          returnLines.map((rl) => [rl.id, rl.invoiceLineId] as const),
        );

        for (const credit of returnCredits) {
          const returnLineId = returnLineByTransaction.get(credit.transactionId);
          const invoiceLineId = returnLineId ? invoiceLineByReturnLine.get(returnLineId) : null;
          if (!invoiceLineId) continue;
          returnedCostByInvoiceLine.set(
            invoiceLineId,
            (returnedCostByInvoiceLine.get(invoiceLineId) ?? 0) + this.toNumber(credit._sum.totalCost),
          );
        }
      }
    }

    const invoiceMap = new Map(invoices.map((inv) => [inv.id, inv]));
    const rows: GrossProfitRow[] = [];

    for (const il of invoiceLines) {
      const inv = invoiceMap.get(il.invoiceId);
      if (!inv) continue;

      // Revenue net of anything credited back against this exact line.
      const revenue = this.toNumber(il.totalPrice) - (creditByInvoiceLine.get(il.id) ?? 0);
      let cogs = 0;

      // Sum every consignment of this order line, not just one of them.
      for (const shipmentLine of soLineToShipmentLines.get(il.salesOrderLineId) ?? []) {
        const linesInShipment = shipmentLinesByShipment.get(shipmentLine.shipmentId) ?? [];
        const position = linesInShipment.findIndex((sl) => sl.id === shipmentLine.id);
        if (position !== -1) {
          const txId = txMap.get(shipmentLine.shipmentId);
          if (txId) {
            const linesInTx = txLinesByTx.get(txId) ?? [];
            const matchedTxLine = linesInTx[position];
            if (matchedTxLine) {
              cogs += costByTxLine.get(matchedTxLine.id) ?? 0;
            }
          }
        }
      }

      // Returned goods stop being the cost of a completed sale.
      cogs -= returnedCostByInvoiceLine.get(il.id) ?? 0;

      const grossProfit = revenue - cogs;
      const marginPercent = revenue > 0 ? Math.round((grossProfit / revenue) * 10000) / 100 : 0;

      rows.push({
        invoiceNumber: inv.invoiceNumber,
        issuedAt: inv.issuedAt,
        customerName: inv.customerName,
        productName: il.productName,
        revenue,
        cogs,
        grossProfit,
        marginPercent,
      });
    }

    return rows;
  }

  async productCostCard(
    productId: string,
    warehouseId: string,
  ): Promise<CostCardData> {
    const organizationId = await this.resolveOrganizationId();

    const productCost = await prisma.productCost.findUnique({
      where: {
        organizationId_productId_warehouseId: {
          organizationId,
          productId,
          warehouseId,
        },
      },
      include: { product: true, warehouse: true },
    });

    const header: CostCardHeader = productCost
      ? {
          productName: productCost.product.name,
          productSku: productCost.product.sku,
          warehouseName: productCost.warehouse.name,
          averageCost: this.toNumber(productCost.averageCost),
          totalQuantity: this.toNumber(productCost.totalQuantity),
          totalValue: this.toNumber(productCost.totalValue),
        }
      : {
          productName: "Unknown",
          productSku: "",
          warehouseName: "Unknown",
          averageCost: 0,
          totalQuantity: 0,
          totalValue: 0,
        };

    const entries = await prisma.inventoryLedgerEntry.findMany({
      where: {
        organizationId,
        productId,
        warehouseId,
        unitCost: { not: null },
      },
      include: {
        transaction: { select: { documentNumber: true, type: true } },
      },
      orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
    });

    const { Decimal } = Prisma;
    let runningQty = new Decimal(0);
    let runningVal = new Decimal(0);
    const costCardRows: CostCardRow[] = entries.map((e) => {
      const qty = new Decimal(this.toNumber(e.quantity));
      const totalCost = new Decimal(this.toNumber(e.totalCost));

      if (e.direction === "IN") {
        runningQty = runningQty.add(qty);
        runningVal = runningVal.add(totalCost);
      } else {
        runningQty = runningQty.sub(qty);
        runningVal = runningVal.sub(totalCost);
      }

      const runningAvg = runningQty.isZero() ? 0 : this.toNumber(runningVal.div(runningQty));

      return {
        occurredAt: e.occurredAt,
        movementType: e.movementType,
        direction: e.direction,
        documentNumber: e.transaction.documentNumber,
        quantity: this.toNumber(e.quantity),
        unitCost: this.toNumber(e.unitCost),
        totalCost: this.toNumber(e.totalCost),
        runningQuantity: this.toNumber(runningQty),
        runningValue: this.toNumber(runningVal),
        runningAvg,
      };
    });

    return { header, entries: costCardRows };
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
