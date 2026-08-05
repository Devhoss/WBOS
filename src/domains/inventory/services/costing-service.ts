import { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";
import { BusinessError } from "@/shared/errors/business-error";

type PrismaTx = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

const MAX_RETRIES = 3;

export class CostingService {
  private async getCost(orgId: string, productId: string, warehouseId: string, tx: PrismaTx) {
    return tx.productCost.findUnique({
      where: {
        organizationId_productId_warehouseId: { organizationId: orgId, productId, warehouseId },
      },
    });
  }

  async recordReceipt(
    input: {
      organizationId: string;
      productId: string;
      warehouseId: string;
      quantity: Prisma.Decimal;
      unitCost: Prisma.Decimal;
      ledgerEntryId: string;
    },
    tx: PrismaTx,
  ): Promise<void> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const current = await this.getCost(input.organizationId, input.productId, input.warehouseId, tx);

      const receiptValue = input.quantity.mul(input.unitCost);
      const oldQty = current?.totalQuantity ?? new Prisma.Decimal(0);
      const oldValue = current?.totalValue ?? new Prisma.Decimal(0);
      const newQuantity = oldQty.add(input.quantity);
      const newValue = oldValue.add(receiptValue);
      const newAverage = newQuantity.isZero() ? new Prisma.Decimal(0) : newValue.div(newQuantity);

      if (!current) {
        await tx.productCost.create({
          data: {
            organizationId: input.organizationId,
            productId: input.productId,
            warehouseId: input.warehouseId,
            averageCost: newAverage,
            totalQuantity: newQuantity,
            totalValue: newValue,
          },
        });
        await this.setLedgerCost(input.ledgerEntryId, input.unitCost, receiptValue, tx);
        return;
      }

      const result = await tx.productCost.updateMany({
        where: { id: current.id, updatedAt: current.updatedAt },
        data: { averageCost: newAverage, totalQuantity: newQuantity, totalValue: newValue },
      });

      if (result.count > 0) {
        await this.setLedgerCost(input.ledgerEntryId, input.unitCost, receiptValue, tx);
        return;
      }

      if (attempt === MAX_RETRIES - 1) {
        throw new BusinessError(
          "Cost record was modified concurrently. Please retry.",
          "COST_CONCURRENCY_CONFLICT",
        );
      }
    }
  }

  async recordIssue(
    input: {
      organizationId: string;
      productId: string;
      warehouseId: string;
      quantity: Prisma.Decimal;
      ledgerEntryId: string;
    },
    tx: PrismaTx,
  ): Promise<{ unitCost: Prisma.Decimal; totalCost: Prisma.Decimal }> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const current = await this.getCost(input.organizationId, input.productId, input.warehouseId, tx);

      const avgCost = current?.averageCost ?? new Prisma.Decimal(0);
      const totalCost = input.quantity.mul(avgCost);

      if (!current) {
        await this.setLedgerCost(input.ledgerEntryId, avgCost, totalCost, tx);
        return { unitCost: avgCost, totalCost };
      }

      const newQuantity = current.totalQuantity.sub(input.quantity);
      const newValue = current.totalValue.sub(totalCost);

      const result = await tx.productCost.updateMany({
        where: { id: current.id, updatedAt: current.updatedAt },
        data: { totalQuantity: newQuantity, totalValue: newValue },
      });

      if (result.count > 0) {
        await this.setLedgerCost(input.ledgerEntryId, avgCost, totalCost, tx);
        return { unitCost: avgCost, totalCost };
      }

      if (attempt === MAX_RETRIES - 1) {
        throw new BusinessError(
          "Cost record was modified concurrently. Please retry.",
          "COST_CONCURRENCY_CONFLICT",
        );
      }
    }

    throw new BusinessError("Unexpected error in recordIssue.", "UNEXPECTED_ERROR");
  }

  async getAverageCost(organizationId: string, productId: string, warehouseId: string): Promise<Prisma.Decimal | null> {
    const cost = await prisma.productCost.findUnique({
      where: {
        organizationId_productId_warehouseId: { organizationId, productId, warehouseId },
      },
    });
    return cost?.averageCost ?? null;
  }

  async recordRevaluation(
    input: {
      organizationId: string;
      productId: string;
      warehouseId: string;
      value: Prisma.Decimal;
      ledgerEntryId: string;
    },
    tx: PrismaTx,
  ): Promise<{ unitCost: Prisma.Decimal; totalCost: Prisma.Decimal }> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const current = await this.getCost(input.organizationId, input.productId, input.warehouseId, tx);

      if (!current || current.totalQuantity.isZero()) {
        throw new BusinessError(
          "Cannot revalue a product with no on-hand quantity.",
          "COST_REVALUATION_ZERO_QUANTITY",
        );
      }

      const newValue = current.totalValue.add(input.value);
      const newAverage = newValue.div(current.totalQuantity);

      const result = await tx.productCost.updateMany({
        where: { id: current.id, updatedAt: current.updatedAt },
        data: { averageCost: newAverage, totalValue: newValue },
      });

      if (result.count > 0) {
        await this.setLedgerCost(input.ledgerEntryId, newAverage, input.value.abs(), tx);
        return { unitCost: newAverage, totalCost: input.value };
      }

      if (attempt === MAX_RETRIES - 1) {
        throw new BusinessError(
          "Cost record was modified concurrently. Please retry.",
          "COST_CONCURRENCY_CONFLICT",
        );
      }
    }

    throw new BusinessError("Unexpected error in recordRevaluation.", "UNEXPECTED_ERROR");
  }

  private async setLedgerCost(ledgerEntryId: string, unitCost: Prisma.Decimal, totalCost: Prisma.Decimal, tx: PrismaTx) {
    await tx.inventoryLedgerEntry.update({
      where: { id: ledgerEntryId },
      data: { unitCost, totalCost },
    });
  }
}
