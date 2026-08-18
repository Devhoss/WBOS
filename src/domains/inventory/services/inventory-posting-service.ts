import { Prisma, type InventoryDirection, type InventoryMovementType } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";
import { BusinessError } from "@/shared/errors/business-error";

import { InventoryLedgerRepository } from "../repositories/inventory-ledger-repository";
import { InventoryTransactionRepository } from "../repositories/inventory-transaction-repository";

export type PostInventoryLedgerEntryInput = {
  warehouseId: string;
  movementType: InventoryMovementType;
  direction: InventoryDirection;
  quantity: Prisma.Decimal.Value;
  unitCost?: Prisma.Decimal.Value | null;
  totalCost?: Prisma.Decimal.Value | null;
};

export type PostInventoryTransactionLineInput = {
  productId: string;
  unitOfMeasureId: string;
  quantity: Prisma.Decimal.Value;
  unitCost?: Prisma.Decimal.Value | null;
  totalCost?: Prisma.Decimal.Value | null;
  fromWarehouseId?: string | null;
  toWarehouseId?: string | null;
  adjustmentReasonId?: string | null;
  notes?: string | null;
  ledgerEntries: PostInventoryLedgerEntryInput[];
};

export type PostInventoryTransactionInput = {
  organizationId: string;
  type: InventoryMovementType;
  documentNumber?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  occurredAt?: Date;
  createdById?: string | null;
  notes?: string | null;
  lines: PostInventoryTransactionLineInput[];
};

export class InventoryPostingService {
  async post(input: PostInventoryTransactionInput, tx?: Prisma.TransactionClient) {
    this.validateInput(input);

    const execute = async (innerTx: Prisma.TransactionClient) => {
      await this.assertStockAvailableForOutflows(innerTx, input);

      const transactions = new InventoryTransactionRepository(innerTx);
      const ledger = new InventoryLedgerRepository(innerTx);
      const occurredAt = input.occurredAt ?? new Date();
      const transaction = await transactions.create({
        organizationId: input.organizationId,
        type: input.type,
        documentNumber: input.documentNumber,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        occurredAt,
        createdById: input.createdById,
        notes: input.notes,
      });

      for (const inputLine of input.lines) {
        const line = await transactions.createLine({
          organizationId: input.organizationId,
          transactionId: transaction.id,
          productId: inputLine.productId,
          unitOfMeasureId: inputLine.unitOfMeasureId,
          quantity: inputLine.quantity,
          unitCost: inputLine.unitCost,
          totalCost: inputLine.totalCost,
          fromWarehouseId: inputLine.fromWarehouseId,
          toWarehouseId: inputLine.toWarehouseId,
          adjustmentReasonId: inputLine.adjustmentReasonId,
          notes: inputLine.notes,
        });

        await ledger.createMany(
          inputLine.ledgerEntries.map((entry) => ({
            organizationId: input.organizationId,
            transactionId: transaction.id,
            transactionLineId: line.id,
            productId: inputLine.productId,
            warehouseId: entry.warehouseId,
            movementType: entry.movementType,
            direction: entry.direction,
            quantity: entry.quantity,
            unitCost: entry.unitCost,
            totalCost: entry.totalCost,
            occurredAt,
          })),
        );
      }

      return transactions.findById(input.organizationId, transaction.id);
    };

    if (tx) {
      return execute(tx);
    }

    return prisma.$transaction(execute);
  }

  /**
   * Refuse any posting that would drive a (product, warehouse) balance below
   * zero.
   *
   * Stock is DERIVED from the append-only ledger, so this invariant is a SUM
   * across many rows and cannot be expressed as a row-level CHECK constraint.
   * To make it race-safe rather than another read-then-write, each affected
   * (product, warehouse) pair is serialised with a transaction-scoped Postgres
   * advisory lock before the balance is read. Concurrent outflows for the same
   * pair therefore queue inside the database and each sees the other's
   * committed effect; the lock is released automatically on commit or rollback.
   *
   * `assertAvailable()` on StockBalanceService already expressed this rule but
   * was never called by any code path, which is why stock could go negative.
   */
  private async assertStockAvailableForOutflows(
    tx: Prisma.TransactionClient,
    input: PostInventoryTransactionInput,
  ) {
    // Net requirement per (product, warehouse) for this posting only.
    const required = new Map<string, { productId: string; warehouseId: string; qty: Prisma.Decimal }>();

    for (const line of input.lines) {
      for (const entry of line.ledgerEntries) {
        if (entry.direction !== "OUT") continue;
        if (entry.movementType === "LANDED_COST") continue; // value-only movement
        const key = `${line.productId}:${entry.warehouseId}`;
        const current = required.get(key);
        const qty = new Prisma.Decimal(entry.quantity);
        required.set(key, {
          productId: line.productId,
          warehouseId: entry.warehouseId,
          qty: current ? current.qty.plus(qty) : qty,
        });
      }
    }

    if (required.size === 0) return;

    // Deterministic order avoids deadlocks between transactions touching the
    // same pairs in different sequences.
    const pairs = [...required.values()].sort((a, b) =>
      `${a.productId}:${a.warehouseId}`.localeCompare(`${b.productId}:${b.warehouseId}`),
    );

    for (const pair of pairs) {
      const lockKey = `${input.organizationId}:${pair.productId}:${pair.warehouseId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;

      const balance = await tx.inventoryLedgerEntry.groupBy({
        by: ["direction"],
        where: {
          organizationId: input.organizationId,
          productId: pair.productId,
          warehouseId: pair.warehouseId,
        },
        _sum: { quantity: true },
      });

      const inQty = new Prisma.Decimal(
        balance.find((b) => b.direction === "IN")?._sum.quantity ?? 0,
      );
      const outQty = new Prisma.Decimal(
        balance.find((b) => b.direction === "OUT")?._sum.quantity ?? 0,
      );
      const onHand = inQty.minus(outQty);

      if (onHand.lessThan(pair.qty)) {
        throw new BusinessError(
          `Insufficient stock: ${onHand.toString()} on hand but ${pair.qty.toString()} required for this movement.`,
          "INVENTORY_INSUFFICIENT_STOCK",
        );
      }
    }
  }

  private validateInput(input: PostInventoryTransactionInput) {
    if (input.lines.length === 0) {
      throw new BusinessError("Inventory transaction must include at least one line.", "INVENTORY_EMPTY_TRANSACTION");
    }

    for (const line of input.lines) {
      this.validateQuantity(line.quantity, input.type);

      if (line.ledgerEntries.length === 0) {
        throw new BusinessError("Inventory transaction line must create ledger entries.", "INVENTORY_LINE_WITHOUT_LEDGER");
      }

      for (const entry of line.ledgerEntries) {
        this.validateQuantity(entry.quantity, entry.movementType);
      }
    }
  }

  private validateQuantity(quantity: Prisma.Decimal.Value, movementType: InventoryMovementType) {
    const decimal = new Prisma.Decimal(quantity);

    if (movementType === "LANDED_COST") {
      if (decimal.lt(0)) {
        throw new BusinessError("Inventory quantity must not be negative.", "INVENTORY_INVALID_QUANTITY");
      }

      return;
    }

    if (decimal.lte(0)) {
      throw new BusinessError("Inventory quantity must be greater than zero.", "INVENTORY_INVALID_QUANTITY");
    }
  }
}
