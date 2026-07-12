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
};

export type PostInventoryTransactionLineInput = {
  productId: string;
  unitOfMeasureId: string;
  quantity: Prisma.Decimal.Value;
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

  private validateInput(input: PostInventoryTransactionInput) {
    if (input.lines.length === 0) {
      throw new BusinessError("Inventory transaction must include at least one line.", "INVENTORY_EMPTY_TRANSACTION");
    }

    for (const line of input.lines) {
      this.validatePositiveQuantity(line.quantity);

      if (line.ledgerEntries.length === 0) {
        throw new BusinessError("Inventory transaction line must create ledger entries.", "INVENTORY_LINE_WITHOUT_LEDGER");
      }

      for (const entry of line.ledgerEntries) {
        this.validatePositiveQuantity(entry.quantity);
      }
    }
  }

  private validatePositiveQuantity(quantity: Prisma.Decimal.Value) {
    const decimal = new Prisma.Decimal(quantity);

    if (decimal.lte(0)) {
      throw new BusinessError("Inventory quantity must be greater than zero.", "INVENTORY_INVALID_QUANTITY");
    }
  }
}
