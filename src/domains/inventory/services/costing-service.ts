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

  /**
   * Receipts fold into the moving-average cost record.
   *
   * The previous shape was read -> branch -> create/update, which had two
   * defects for a brand-new (product, warehouse) pair: both concurrent first
   * receipts saw `current == null`, both called `create()`, and the loser
   * surfaced a raw PostgreSQL unique-violation instead of a business error.
   * Worse, a unique violation aborts the surrounding transaction, so the retry
   * loop above it could never have recovered from it anyway.
   *
   * It is now a single upsert. Prisma compiles this to
   * `INSERT ... ON CONFLICT ("organizationId","productId","warehouseId") DO UPDATE`,
   * so the second writer blocks on the unique index, then takes the update
   * branch against the row the first writer committed. Nothing is read before
   * the write, so there is no window to lose; the quantity and value arrive as
   * `increment`, so neither contribution can be overwritten.
   *
   * The average is then recomputed from the row's own committed columns. That
   * statement is safe because the upsert already holds the row lock for the
   * remainder of this transaction — no other writer can interleave between the
   * two statements.
   *
   * `.e2e/costing-first-insert.e2e.test.ts` is the guard on the ON CONFLICT
   * behaviour: it races two genuinely concurrent first receipts.
   */
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
    const receiptValue = input.quantity.mul(input.unitCost);

    const row = await tx.productCost.upsert({
      where: {
        organizationId_productId_warehouseId: {
          organizationId: input.organizationId,
          productId: input.productId,
          warehouseId: input.warehouseId,
        },
      },
      create: {
        organizationId: input.organizationId,
        productId: input.productId,
        warehouseId: input.warehouseId,
        averageCost: input.quantity.isZero() ? new Prisma.Decimal(0) : input.unitCost,
        totalQuantity: input.quantity,
        totalValue: receiptValue,
      },
      update: {
        totalQuantity: { increment: input.quantity },
        totalValue: { increment: receiptValue },
      },
      select: { id: true },
    });

    await tx.$executeRaw`
      UPDATE "product_costs"
         SET "averageCost" = CASE
               WHEN "totalQuantity" = 0 THEN 0
               ELSE "totalValue" / "totalQuantity"
             END
       WHERE "id" = ${row.id}
    `;

    await this.setLedgerCost(input.ledgerEntryId, input.unitCost, receiptValue, tx);
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
