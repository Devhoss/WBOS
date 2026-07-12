import { Prisma } from "@prisma/client";

import { BusinessError } from "@/shared/errors/business-error";
import { prisma } from "@/infrastructure/database/prisma";

import { InventoryLedgerRepository } from "../repositories/inventory-ledger-repository";

export type StockBalance = {
  productId: string;
  warehouseId: string;
  quantity: Prisma.Decimal;
};

export type StockBalanceDetail = {
  productId: string;
  warehouseId: string;
  onHand: Prisma.Decimal;
  reserved: Prisma.Decimal;
  available: Prisma.Decimal;
};

type LedgerAggregateRow = Awaited<ReturnType<InventoryLedgerRepository["aggregateByProductAndWarehouse"]>>[number];

export class StockBalanceService {
  constructor(private readonly ledger = new InventoryLedgerRepository()) {}

  async getStockByProduct(organizationId: string, productId: string) {
    const balances = await this.getBalances(organizationId, productId);

    return balances.reduce((total, balance) => total.plus(balance.quantity), new Prisma.Decimal(0));
  }

  async getStockByWarehouse(organizationId: string, warehouseId: string) {
    return this.getBalances(organizationId, undefined, warehouseId);
  }

  async getStockForProductInWarehouse(organizationId: string, productId: string, warehouseId: string) {
    const balances = await this.getBalances(organizationId, productId, warehouseId);
    const balance = balances[0];

    return balance?.quantity ?? new Prisma.Decimal(0);
  }

  async getAllStockBalances(organizationId: string) {
    return this.getBalances(organizationId);
  }

  async getStockBalancesDetail(organizationId: string) {
    const [balances, reservedMap] = await Promise.all([
      this.getBalances(organizationId),
      this.getReservedQuantities(organizationId),
    ]);

    return balances.map((b) => {
      const key = `${b.productId}:${b.warehouseId}`;
      const reserved = reservedMap.get(key) ?? new Prisma.Decimal(0);
      const onHand = b.quantity;

      return {
        productId: b.productId,
        warehouseId: b.warehouseId,
        onHand,
        reserved,
        available: Prisma.Decimal.max(onHand.minus(reserved), new Prisma.Decimal(0)),
      };
    });
  }

  async assertAvailable(organizationId: string, productId: string, warehouseId: string, requiredQuantity: Prisma.Decimal.Value) {
    const onHand = await this.getStockForProductInWarehouse(organizationId, productId, warehouseId);
    const reserved = await this.getReservedQuantity(organizationId, productId, warehouseId);
    const available = onHand.minus(reserved);
    const required = new Prisma.Decimal(requiredQuantity);

    if (available.lt(required)) {
      throw new BusinessError("Insufficient stock is available for this inventory movement.", "INVENTORY_INSUFFICIENT_STOCK");
    }
  }

  private async getReservedQuantity(organizationId: string, productId: string, warehouseId: string) {
    const result = await prisma.shipmentLine.aggregate({
      where: {
        organizationId,
        productId,
        shipment: {
          warehouseId,
          status: { notIn: ["DELIVERED", "FAILED"] },
        },
      },
      _sum: { quantity: true },
    });

    return result._sum.quantity ?? new Prisma.Decimal(0);
  }

  private async getReservedQuantities(organizationId: string) {
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
        shipment: { select: { warehouseId: true } },
      },
    });

    const reservedMap = new Map<string, Prisma.Decimal>();
    for (const line of lines) {
      const key = `${line.productId}:${line.shipment.warehouseId}`;
      const current = reservedMap.get(key) ?? new Prisma.Decimal(0);
      reservedMap.set(key, current.plus(line.quantity));
    }

    return reservedMap;
  }

  private async getBalances(organizationId: string, productId?: string, warehouseId?: string) {
    const rows = await this.ledger.aggregateByProductAndWarehouse(organizationId, productId, warehouseId);
    const balanceMap = new Map<string, StockBalance>();

    for (const row of rows) {
      const key = this.getBalanceKey(row);
      const current = balanceMap.get(key) ?? {
        productId: row.productId,
        warehouseId: row.warehouseId,
        quantity: new Prisma.Decimal(0),
      };
      const quantity = row._sum.quantity ?? new Prisma.Decimal(0);

      balanceMap.set(key, {
        ...current,
        quantity: row.direction === "IN" ? current.quantity.plus(quantity) : current.quantity.minus(quantity),
      });
    }

    return [...balanceMap.values()].filter((balance) => !balance.quantity.isZero());
  }

  private getBalanceKey(row: LedgerAggregateRow) {
    return `${row.productId}:${row.warehouseId}`;
  }
}
