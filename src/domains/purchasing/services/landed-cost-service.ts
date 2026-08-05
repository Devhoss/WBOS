import { Prisma } from "@prisma/client";
import type { LandedCostAllocationBasis, OrganizationRole } from "@prisma/client";

import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import { DocumentNumberService } from "@/domains/documents/services/document-number-service";
import { CostingService } from "@/domains/inventory/services/costing-service";
import { InventoryPostingService } from "@/domains/inventory/services/inventory-posting-service";
import { StockBalanceService } from "@/domains/inventory/services/stock-balance-service";
import { prisma } from "@/infrastructure/database/prisma";
import { requireAnyRole } from "@/infrastructure/authorization/rbac";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { AllocationService, type AllocationCell, type AllocationResult } from "./allocation-service";
import type { LandedCostCreateInput, LandedCostUpdateInput } from "../validation/landed-cost-schema";

const DRAFT_EDIT_ROLES: readonly OrganizationRole[] = [
  "WAREHOUSE",
  "FINANCE",
  "MANAGER",
  "ADMIN",
  "OWNER",
];

const POST_ROLES: readonly OrganizationRole[] = ["FINANCE", "ADMIN", "OWNER"];

export class LandedCostService {
  constructor(
    private readonly documents = new DocumentNumberService(),
    private readonly allocation = new AllocationService(),
    private readonly balances = new StockBalanceService(),
    private readonly activityLogs = new ActivityLogRepository(),
    private readonly posting = new InventoryPostingService(),
    private readonly costing = new CostingService(),
  ) {}

  async create(context: AuthenticatedRequestContext, input: LandedCostCreateInput) {
    requireAnyRole(context, DRAFT_EDIT_ROLES);

    const now = new Date();
    const { documentNumber } = await this.documents.generate({
      organizationId: context.organizationId,
      documentType: "LC",
      year: now.getFullYear(),
      prefix: "LC",
    });

    const expenseRows = input.expenses.map((expense) => ({
      organizationId: context.organizationId,
      expenseType: expense.expenseType,
      description: expense.description ?? null,
      currency: expense.currency,
      exchangeRate: new Prisma.Decimal(expense.exchangeRate),
      amount: new Prisma.Decimal(expense.amount),
      baseAmount: new Prisma.Decimal(expense.amount).mul(expense.exchangeRate),
    }));

    return prisma.$transaction(async (tx) => {
      const landedCost = await tx.landedCost.create({
        data: {
          organizationId: context.organizationId,
          lcNumber: documentNumber,
          supplierId: input.supplierId ?? null,
          allocationBasis: input.allocationBasis,
          postingDate: input.postingDate ?? null,
          currency: input.currency,
          exchangeRate: new Prisma.Decimal(input.exchangeRate),
          notes: input.notes ?? null,
          createdById: context.userId,
          expenses: { create: expenseRows },
        },
        include: { expenses: true },
      });

      await this.linkReceiptsInTx(context.organizationId, landedCost.id, input.receiptTransactionIds, tx);

      return this.getById(context, landedCost.id, tx);
    });
  }

  async update(context: AuthenticatedRequestContext, id: string, input: Omit<LandedCostUpdateInput, "id">) {
    requireAnyRole(context, DRAFT_EDIT_ROLES);

    const existing = await this.findById(context.organizationId, id);

    if (!existing) {
      throw new BusinessError("Landed cost was not found.", "LANDED_COST_NOT_FOUND");
    }

    if (existing.status !== "DRAFT") {
      throw new BusinessError(
        "Only draft landed costs can be edited.",
        "LANDED_COST_NOT_DRAFT",
      );
    }

    return prisma.$transaction(async (tx) => {
      if (input.expenses) {
        await tx.landedCostExpense.deleteMany({
          where: { landedCostId: id, organizationId: context.organizationId },
        });

        await tx.landedCostExpense.createMany({
          data: input.expenses.map((expense) => ({
            organizationId: context.organizationId,
            landedCostId: id,
            expenseType: expense.expenseType,
            description: expense.description ?? null,
            currency: expense.currency,
            exchangeRate: new Prisma.Decimal(expense.exchangeRate),
            amount: new Prisma.Decimal(expense.amount),
            baseAmount: new Prisma.Decimal(expense.amount).mul(expense.exchangeRate),
          })),
        });
      }

      if (input.lines) {
        const lineIds = new Set(input.lines.map((line) => line.id));

        const ownedLines = await tx.landedCostLine.findMany({
          where: {
            id: { in: [...lineIds] },
            landedCostId: id,
            organizationId: context.organizationId,
          },
          select: { id: true },
        });

        if (ownedLines.length !== lineIds.size) {
          throw new BusinessError(
            "One or more lines do not belong to this landed cost.",
            "LANDED_COST_LINE_NOT_FOUND",
          );
        }

        for (const line of input.lines) {
          await tx.landedCostLine.update({
            where: { id: line.id },
            data: {
              invoiceValue: new Prisma.Decimal(line.invoiceValue),
              weightTotal: line.weightTotal === undefined ? undefined : new Prisma.Decimal(line.weightTotal),
              volumeTotal: line.volumeTotal === undefined ? undefined : new Prisma.Decimal(line.volumeTotal),
              allocatedAmount: line.allocatedAmount === undefined ? undefined : new Prisma.Decimal(line.allocatedAmount),
            },
          });
        }
      }

      await tx.landedCost.update({
        where: { id, organizationId: context.organizationId },
        data: {
          supplierId: input.supplierId === undefined ? undefined : (input.supplierId ?? null),
          allocationBasis: input.allocationBasis,
          postingDate: input.postingDate,
          currency: input.currency,
          exchangeRate: input.exchangeRate === undefined ? undefined : new Prisma.Decimal(input.exchangeRate),
          notes: input.notes === undefined ? undefined : (input.notes ?? null),
        },
      });

      return this.getById(context, id, tx);
    });
  }

  async linkReceipts(context: AuthenticatedRequestContext, id: string, transactionIds: string[]) {
    requireAnyRole(context, DRAFT_EDIT_ROLES);

    const existing = await this.findById(context.organizationId, id);

    if (!existing) {
      throw new BusinessError("Landed cost was not found.", "LANDED_COST_NOT_FOUND");
    }

    if (existing.status !== "DRAFT") {
      throw new BusinessError(
        "Goods receipts can only be linked to draft landed costs.",
        "LANDED_COST_NOT_DRAFT",
      );
    }

    return prisma.$transaction(async (tx) => {
      await this.linkReceiptsInTx(context.organizationId, id, transactionIds, tx);
      return this.getById(context, id, tx);
    });
  }

  async preview(
    context: AuthenticatedRequestContext,
    id: string,
    overrides?: { basis?: LandedCostAllocationBasis; manualCells?: AllocationCell[] },
  ) {
    const landedCost = await this.findById(context.organizationId, id);

    if (!landedCost) {
      throw new BusinessError("Landed cost was not found.", "LANDED_COST_NOT_FOUND");
    }

    const expenses = landedCost.expenses.map((expense) => ({
      id: expense.id,
      baseAmount: expense.baseAmount,
    }));

    const lines = landedCost.lines.map((line) => ({
      id: line.id,
      quantity: line.quantity,
      invoiceValue: line.invoiceValue,
      weightTotal: line.weightTotal,
      volumeTotal: line.volumeTotal,
    }));

    const basis = overrides?.basis ?? landedCost.allocationBasis;

    let allocation;

    if (basis === "MANUAL") {
      const manualCells = overrides?.manualCells
        ? overrides.manualCells
        : landedCost.allocations.map((a) => ({
            lineId: a.lineId,
            expenseId: a.expenseId,
            amount: a.amount,
          }));

      this.allocation.validateManual({
        lines,
        expenses,
        cells: manualCells,
      });
      allocation = this.summarizeManual(manualCells);
    } else {
      allocation = this.allocation.allocate({ basis, lines, expenses });
    }

    const onHandByLine: Record<string, Prisma.Decimal> = {};

    for (const line of landedCost.lines) {
      onHandByLine[line.id] = await this.balances.getStockForProductInWarehouse(
        context.organizationId,
        line.productId,
        line.warehouseId,
      );
    }

    return {
      landedCost,
      allocation,
      onHand: onHandByLine,
      lines: landedCost.lines.map((line) => ({
        ...line,
        onHand: onHandByLine[line.id],
        postingTreatment: onHandByLine[line.id]?.gt(0) ? "CAPITALIZED" : "EXPENSED",
      })),
    };
  }

  async saveAllocations(
    context: AuthenticatedRequestContext,
    id: string,
    cells: Array<{ lineId: string; expenseId: string; amount: Prisma.Decimal.Value }>,
  ) {
    requireAnyRole(context, DRAFT_EDIT_ROLES);

    const existing = await this.findById(context.organizationId, id);

    if (!existing) {
      throw new BusinessError("Landed cost was not found.", "LANDED_COST_NOT_FOUND");
    }

    if (existing.status !== "DRAFT") {
      throw new BusinessError(
        "Allocations can only be saved on draft landed costs.",
        "LANDED_COST_NOT_DRAFT",
      );
    }

    if (existing.allocationBasis !== "MANUAL") {
      throw new BusinessError(
        "Manual allocations can only be saved when the basis is MANUAL.",
        "LANDED_COST_NOT_MANUAL",
      );
    }

    this.allocation.validateManual({
      lines: existing.lines.map((line) => ({
        id: line.id,
        quantity: line.quantity,
        invoiceValue: line.invoiceValue,
        weightTotal: line.weightTotal,
        volumeTotal: line.volumeTotal,
      })),
      expenses: existing.expenses.map((expense) => ({
        id: expense.id,
        baseAmount: expense.baseAmount,
      })),
      cells: cells.map((cell) => ({ ...cell, amount: new Prisma.Decimal(cell.amount) })),
    });

    return prisma.$transaction(async (tx) => {
      await tx.landedCostAllocation.deleteMany({
        where: { landedCostId: id, organizationId: context.organizationId },
      });

      if (cells.length > 0) {
        await tx.landedCostAllocation.createMany({
          data: cells.map((cell) => ({
            organizationId: context.organizationId,
            landedCostId: id,
            lineId: cell.lineId,
            expenseId: cell.expenseId,
            amount: new Prisma.Decimal(cell.amount),
          })),
        });
      }

      const summary = this.summarizeManual(
        cells.map((cell) => ({ ...cell, amount: new Prisma.Decimal(cell.amount) })),
      );

      for (const line of existing.lines) {
        await tx.landedCostLine.update({
          where: { id: line.id },
          data: { allocatedAmount: summary.lineTotals[line.id] ?? new Prisma.Decimal(0) },
        });
      }

      return this.getById(context, id, tx);
    });
  }

  async getById(
    context: AuthenticatedRequestContext,
    id: string,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    const landedCost = await this.findById(context.organizationId, id, client);

    if (!landedCost) {
      throw new BusinessError("Landed cost was not found.", "LANDED_COST_NOT_FOUND");
    }

    return landedCost;
  }

  async list(
    context: AuthenticatedRequestContext,
    filters: {
      status?: string;
      supplierId?: string;
      skip?: number;
      take?: number;
    } = {},
  ) {
    const where: Prisma.LandedCostWhereInput = { organizationId: context.organizationId };

    if (filters.status) {
      where.status = filters.status as never;
    }

    if (filters.supplierId) {
      where.supplierId = filters.supplierId;
    }

    const [items, total] = await Promise.all([
      prisma.landedCost.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          postedBy: { select: { id: true, name: true, email: true } },
          expenses: true,
          lines: true,
          receipts: true,
        },
        orderBy: { createdAt: "desc" },
        skip: filters.skip ?? 0,
        take: filters.take ?? 50,
      }),
      prisma.landedCost.count({ where }),
    ]);

    return { items, total };
  }

  async listEligibleReceipts(context: AuthenticatedRequestContext) {
    const linked = await prisma.landedCostReceipt.findMany({
      where: {
        organizationId: context.organizationId,
        landedCost: { status: { in: ["DRAFT", "POSTED"] } },
      },
      select: { inventoryTransactionId: true },
    });

    const linkedIds = new Set(linked.map((link) => link.inventoryTransactionId));

    const transactions = await prisma.inventoryTransaction.findMany({
      where: {
        organizationId: context.organizationId,
        type: "PURCHASE_RECEIPT",
        status: "POSTED",
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        lines: {
          include: {
            product: { select: { id: true, sku: true, name: true } },
            toWarehouse: { select: { id: true, name: true, code: true } },
            fromWarehouse: { select: { id: true, name: true, code: true } },
            ledgerEntries: true,
          },
        },
      },
      orderBy: { occurredAt: "desc" },
      take: 100,
    });

    return transactions
      .filter((transaction) => !linkedIds.has(transaction.id))
      .map((transaction) => ({
        id: transaction.id,
        documentNumber: transaction.documentNumber ?? transaction.id,
        occurredAt: transaction.occurredAt.toISOString(),
        receivedBy: transaction.createdBy?.name ?? transaction.createdBy?.email ?? null,
        lineCount: transaction.lines.length,
        lines: transaction.lines.map((line) => {
          const inEntry = line.ledgerEntries.find((entry) => entry.direction === "IN");

          return {
            id: line.id,
            productId: line.product.id,
            sku: line.product.sku,
            name: line.product.name,
            quantity: Number(line.quantity),
            warehouseName: line.toWarehouse?.name ?? line.fromWarehouse?.name ?? null,
            receivedValue: Number(inEntry?.totalCost ?? 0),
          };
        }),
      }));
  }

  private async linkReceiptsInTx(
    organizationId: string,
    landedCostId: string,
    transactionIds: string[],
    tx: Prisma.TransactionClient,
  ) {
    const uniqueIds = [...new Set(transactionIds)];

    const transactions = await tx.inventoryTransaction.findMany({
      where: {
        id: { in: uniqueIds },
        organizationId,
        type: "PURCHASE_RECEIPT",
        status: "POSTED",
      },
      include: {
        lines: {
          include: {
            ledgerEntries: true,
          },
        },
      },
    });

    const validIds = new Set(transactions.map((t) => t.id));

    for (const transactionId of uniqueIds) {
      if (!validIds.has(transactionId)) {
        throw new BusinessError(
          `Goods receipt ${transactionId} was not found or is not a posted purchase receipt.`,
          "LANDED_COST_RECEIPT_NOT_FOUND",
        );
      }
    }

    const existingLinks = await tx.landedCostReceipt.findMany({
      where: {
        landedCostId,
        organizationId,
        inventoryTransactionId: { in: uniqueIds },
      },
      select: { inventoryTransactionId: true },
    });

    if (existingLinks.length > 0) {
      throw new BusinessError(
        "One or more goods receipts are already linked to this landed cost.",
        "LANDED_COST_RECEIPT_ALREADY_LINKED",
      );
    }

    const productIds = [
      ...new Set(transactions.flatMap((t) => t.lines.map((line) => line.productId))),
    ];

    const products = await tx.product.findMany({
      where: { id: { in: productIds }, organizationId },
    });

    const productMap = new Map(products.map((product) => [product.id, product]));

    for (const transaction of transactions) {
      await tx.landedCostReceipt.create({
        data: {
          organizationId,
          landedCostId,
          inventoryTransactionId: transaction.id,
        },
      });

      for (const line of transaction.lines) {
        const product = productMap.get(line.productId);
        const inEntry = line.ledgerEntries.find((entry) => entry.direction === "IN");
        const warehouseId = inEntry?.warehouseId ?? line.toWarehouseId ?? line.fromWarehouseId;
        const receivedValue = line.ledgerEntries
          .filter((entry) => entry.direction === "IN")
          .reduce((sum, entry) => sum.plus(entry.totalCost ?? new Prisma.Decimal(0)), new Prisma.Decimal(0));

        await tx.landedCostLine.create({
          data: {
            organizationId,
            landedCostId,
            productId: line.productId,
            warehouseId: warehouseId ?? "",
            unitOfMeasureId: line.unitOfMeasureId,
            quantity: line.quantity,
            invoiceValue: receivedValue,
            weightTotal:
              product?.weightPerUnit === null || product?.weightPerUnit === undefined
                ? null
                : new Prisma.Decimal(product.weightPerUnit).mul(line.quantity),
            volumeTotal:
              product?.volumePerUnit === null || product?.volumePerUnit === undefined
                ? null
                : new Prisma.Decimal(product.volumePerUnit).mul(line.quantity),
            allocatedAmount: new Prisma.Decimal(0),
          },
        });
      }
    }
  }

  private summarizeManual(cells: { lineId: string; expenseId: string; amount: Prisma.Decimal }[]) {
    const lineTotals: Record<string, Prisma.Decimal> = {};
    const expenseTotals: Record<string, Prisma.Decimal> = {};
    let grandTotal = new Prisma.Decimal(0);

    for (const cell of cells) {
      lineTotals[cell.lineId] = (lineTotals[cell.lineId] ?? new Prisma.Decimal(0)).plus(cell.amount);
      expenseTotals[cell.expenseId] = (expenseTotals[cell.expenseId] ?? new Prisma.Decimal(0)).plus(cell.amount);
      grandTotal = grandTotal.plus(cell.amount);
    }

    const mappedCells: AllocationCell[] = cells.map((cell) => ({
      lineId: cell.lineId,
      expenseId: cell.expenseId,
      amount: cell.amount,
    }));

    return { cells: mappedCells, lineTotals, expenseTotals, grandTotal, residual: new Prisma.Decimal(0) };
  }

  async post(context: AuthenticatedRequestContext, id: string) {
    requireAnyRole(context, POST_ROLES);

    return prisma.$transaction(async (tx) => {
      const locked = await this.lockLandedCost(tx, context.organizationId, id);

      if (!locked) {
        throw new BusinessError("Landed cost was not found.", "LANDED_COST_NOT_FOUND");
      }

      if (locked.status !== "DRAFT") {
        throw new BusinessError(
          "Only draft landed costs can be posted.",
          "LANDED_COST_NOT_DRAFT",
        );
      }

      const landedCost = await this.findById(context.organizationId, id, tx);

      if (!landedCost) {
        throw new BusinessError("Landed cost was not found.", "LANDED_COST_NOT_FOUND");
      }

      if (landedCost.expenses.length === 0) {
        throw new BusinessError(
          "Landed cost requires at least one expense.",
          "LANDED_COST_NO_EXPENSES",
        );
      }

      if (landedCost.expenses.every((expense) => expense.baseAmount.lte(0))) {
        throw new BusinessError(
          "At least one expense must have a positive value.",
          "LANDED_COST_NO_POSITIVE_EXPENSE",
        );
      }

      if (landedCost.lines.length === 0) {
        throw new BusinessError(
          "Landed cost requires at least one line.",
          "LANDED_COST_NO_LINES",
        );
      }

      if (landedCost.lines.some((line) => line.quantity.lte(0))) {
        throw new BusinessError(
          "Landed cost lines must have positive quantities.",
          "LANDED_COST_INVALID_LINE_QUANTITY",
        );
      }

      const receiptIds = landedCost.receipts.map((receipt) => receipt.inventoryTransactionId);

      if (receiptIds.length > 0) {
        const validReceiptCount = await tx.inventoryTransaction.count({
          where: {
            id: { in: receiptIds },
            organizationId: context.organizationId,
            type: "PURCHASE_RECEIPT",
            status: "POSTED",
          },
        });

        if (validReceiptCount !== receiptIds.length) {
          throw new BusinessError(
            "One or more linked goods receipts are not posted purchase receipts.",
            "LANDED_COST_RECEIPT_NOT_FOUND",
          );
        }
      }

      const expenseInputs = landedCost.expenses.map((expense) => ({
        id: expense.id,
        baseAmount: expense.baseAmount,
      }));

      const lineInputs = landedCost.lines.map((line) => ({
        id: line.id,
        quantity: line.quantity,
        invoiceValue: line.invoiceValue,
        weightTotal: line.weightTotal,
        volumeTotal: line.volumeTotal,
      }));

      let allocation: AllocationResult;

      if (landedCost.allocationBasis === "MANUAL") {
        this.allocation.validateManual({
          lines: lineInputs,
          expenses: expenseInputs,
          cells: landedCost.allocations.map((cell) => ({
            lineId: cell.lineId,
            expenseId: cell.expenseId,
            amount: cell.amount,
          })),
        });
        allocation = this.summarizeManual(landedCost.allocations);
      } else {
        allocation = this.allocation.allocate({
          basis: landedCost.allocationBasis,
          lines: lineInputs,
          expenses: expenseInputs,
        });
      }

      const onHandByLine = new Map<string, Prisma.Decimal>();

      for (const line of landedCost.lines) {
        const onHand = await this.getOnHandInWarehouse(
          tx,
          context.organizationId,
          line.productId,
          line.warehouseId,
        );
        onHandByLine.set(line.id, onHand);
      }

      const treatmentByLine = new Map<string, "CAPITALIZED" | "EXPENSED">();

      for (const line of landedCost.lines) {
        const onHand = onHandByLine.get(line.id) ?? new Prisma.Decimal(0);
        treatmentByLine.set(line.id, onHand.gt(0) ? "CAPITALIZED" : "EXPENSED");
      }

      const capitalizedByKey = new Map<
        string,
        { productId: string; warehouseId: string; unitOfMeasureId: string; value: Prisma.Decimal }
      >();

      for (const line of landedCost.lines) {
        const share = allocation.lineTotals[line.id] ?? new Prisma.Decimal(0);

        if (treatmentByLine.get(line.id) !== "CAPITALIZED" || share.lte(0)) {
          continue;
        }

        const key = `${line.productId}:${line.warehouseId}`;
        const existing = capitalizedByKey.get(key);

        if (existing) {
          existing.value = existing.value.plus(share);
        } else {
          capitalizedByKey.set(key, {
            productId: line.productId,
            warehouseId: line.warehouseId,
            unitOfMeasureId: line.unitOfMeasureId,
            value: share,
          });
        }
      }

      let inventoryTransactionId: string | null = null;

      if (capitalizedByKey.size > 0) {
        const transaction = await this.posting.post(
          {
            organizationId: context.organizationId,
            type: "LANDED_COST",
            documentNumber: landedCost.lcNumber,
            referenceType: "LANDED_COST",
            referenceId: landedCost.id,
            occurredAt: landedCost.postingDate ?? new Date(),
            createdById: context.userId,
            notes: landedCost.notes,
            lines: [...capitalizedByKey.values()].map((group) => ({
              productId: group.productId,
              unitOfMeasureId: group.unitOfMeasureId,
              quantity: new Prisma.Decimal(0),
              ledgerEntries: [
                {
                  warehouseId: group.warehouseId,
                  movementType: "LANDED_COST",
                  direction: "IN",
                  quantity: new Prisma.Decimal(0),
                },
              ],
            })),
          },
          tx,
        );

        if (!transaction) {
          throw new BusinessError("Failed to create the landed cost posting.", "LANDED_COST_POST_FAILED");
        }

        inventoryTransactionId = transaction.id;

        const groups = [...capitalizedByKey.values()];

        for (let i = 0; i < groups.length; i++) {
          const group = groups[i];
          const invLine = transaction.lines[i];
          const entry = invLine?.ledgerEntries[0];

          if (!entry) {
            continue;
          }

          await this.costing.recordRevaluation(
            {
              organizationId: context.organizationId,
              productId: group.productId,
              warehouseId: group.warehouseId,
              value: group.value,
              ledgerEntryId: entry.id,
            },
            tx,
          );
        }
      }

      await tx.landedCostAllocation.deleteMany({
        where: { landedCostId: id, organizationId: context.organizationId },
      });

      if (allocation.cells.length > 0) {
        await tx.landedCostAllocation.createMany({
          data: allocation.cells.map((cell) => ({
            organizationId: context.organizationId,
            landedCostId: id,
            lineId: cell.lineId,
            expenseId: cell.expenseId,
            amount: cell.amount,
          })),
        });
      }

      for (const line of landedCost.lines) {
        await tx.landedCostLine.update({
          where: { id: line.id },
          data: {
            allocatedAmount: allocation.lineTotals[line.id] ?? new Prisma.Decimal(0),
            postingTreatment: treatmentByLine.get(line.id),
          },
        });
      }

      await tx.landedCost.update({
        where: { id, organizationId: context.organizationId },
        data: {
          status: "POSTED",
          postedById: context.userId,
          postedAt: new Date(),
          inventoryTransactionId,
        },
      });

      await tx.activityLog.create({
        data: {
          organizationId: context.organizationId,
          userId: context.userId,
          action: "LANDED_COST_POSTED",
          entityType: "LandedCost",
          entityId: id,
          summary: `Landed cost ${landedCost.lcNumber} posted for ${allocation.grandTotal} ${landedCost.currency}.`,
          metadata: {
            lcNumber: landedCost.lcNumber,
            totalValue: allocation.grandTotal.toString(),
            inventoryTransactionId,
          },
        },
      });

      return this.findById(context.organizationId, id, tx);
    });
  }

  async cancel(context: AuthenticatedRequestContext, id: string) {
    requireAnyRole(context, POST_ROLES);

    return prisma.$transaction(async (tx) => {
      const locked = await this.lockLandedCost(tx, context.organizationId, id);

      if (!locked) {
        throw new BusinessError("Landed cost was not found.", "LANDED_COST_NOT_FOUND");
      }

      if (locked.status !== "POSTED") {
        throw new BusinessError(
          "Only posted landed costs can be cancelled.",
          "LANDED_COST_NOT_POSTED",
        );
      }

      const landedCost = await this.findById(context.organizationId, id, tx);

      if (!landedCost) {
        throw new BusinessError("Landed cost was not found.", "LANDED_COST_NOT_FOUND");
      }

      let reversalTransactionId: string | null = null;

      if (landedCost.inventoryTransactionId) {
        const original = await tx.inventoryTransaction.findFirst({
          where: {
            id: landedCost.inventoryTransactionId,
            organizationId: context.organizationId,
            type: "LANDED_COST",
          },
          include: {
            lines: {
              include: {
                ledgerEntries: true,
              },
            },
          },
        });

        if (original && original.lines.length > 0) {
          const reversal = await this.posting.post(
            {
              organizationId: context.organizationId,
              type: "LANDED_COST",
              documentNumber: landedCost.lcNumber,
              referenceType: "LANDED_COST_REVERSAL",
              referenceId: landedCost.id,
              occurredAt: new Date(),
              createdById: context.userId,
              notes: `Reversal of landed cost ${landedCost.lcNumber}.`,
              lines: original.lines.map((line) => {
                const inEntry = line.ledgerEntries.find((entry) => entry.direction === "IN");

                return {
                  productId: line.productId,
                  unitOfMeasureId: line.unitOfMeasureId,
                  quantity: new Prisma.Decimal(0),
                  ledgerEntries: [
                    {
                      warehouseId: inEntry?.warehouseId ?? line.toWarehouseId ?? line.fromWarehouseId ?? "",
                      movementType: "LANDED_COST",
                      direction: "OUT",
                      quantity: new Prisma.Decimal(0),
                    },
                  ],
                };
              }),
            },
            tx,
          );

          if (!reversal) {
            throw new BusinessError("Failed to create the landed cost reversal.", "LANDED_COST_CANCEL_FAILED");
          }

          reversalTransactionId = reversal.id;

          for (let i = 0; i < original.lines.length; i++) {
            const originalLine = original.lines[i];
            const inEntry = originalLine.ledgerEntries.find((entry) => entry.direction === "IN");
            const reversalLine = reversal.lines[i];
            const reversalEntry = reversalLine?.ledgerEntries[0];

            if (!inEntry || !reversalEntry) {
              continue;
            }

            const share = inEntry.totalCost ?? new Prisma.Decimal(0);

            await this.costing.recordRevaluation(
              {
                organizationId: context.organizationId,
                productId: originalLine.productId,
                warehouseId: reversalEntry.warehouseId,
                value: share.neg(),
                ledgerEntryId: reversalEntry.id,
              },
              tx,
            );
          }
        }
      }

      await tx.landedCost.update({
        where: { id, organizationId: context.organizationId },
        data: {
          status: "CANCELLED",
          cancelledById: context.userId,
          cancelledAt: new Date(),
        },
      });

      await tx.activityLog.create({
        data: {
          organizationId: context.organizationId,
          userId: context.userId,
          action: "LANDED_COST_CANCELLED",
          entityType: "LandedCost",
          entityId: id,
          summary: `Landed cost ${landedCost.lcNumber} cancelled.`,
          metadata: {
            lcNumber: landedCost.lcNumber,
            reversalTransactionId,
          },
        },
      });

      return this.findById(context.organizationId, id, tx);
    });
  }

  private async lockLandedCost(
    tx: Prisma.TransactionClient,
    organizationId: string,
    id: string,
  ) {
    const rows = await tx.$queryRaw<Array<{ id: string; status: string }>>(
      Prisma.sql`SELECT "id", "status" FROM "landed_costs" WHERE "id" = ${id} AND "organizationId" = ${organizationId} FOR UPDATE`,
    );

    return rows[0] ?? null;
  }

  private async getOnHandInWarehouse(
    tx: Prisma.TransactionClient,
    organizationId: string,
    productId: string,
    warehouseId: string,
  ) {
    const rows = await tx.inventoryLedgerEntry.groupBy({
      by: ["direction"],
      where: { organizationId, productId, warehouseId },
      _sum: { quantity: true },
    });

    let onHand = new Prisma.Decimal(0);

    for (const row of rows) {
      const sum = row._sum.quantity ?? new Prisma.Decimal(0);
      onHand = row.direction === "IN" ? onHand.plus(sum) : onHand.minus(sum);
    }

    return onHand;
  }

  private async findById(
    organizationId: string,
    id: string,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.landedCost.findFirst({
      where: { id, organizationId },
      include: {
        supplier: true,
        createdBy: { select: { id: true, name: true, email: true } },
        postedBy: { select: { id: true, name: true, email: true } },
        cancelledBy: { select: { id: true, name: true, email: true } },
        expenses: { orderBy: { id: "asc" } },
        lines: { orderBy: { id: "asc" } },
        receipts: true,
        allocations: true,
      },
    });
  }
}
