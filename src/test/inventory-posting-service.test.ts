import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const { mockTx } = vi.hoisted(() => {
  const mockCreate = vi.fn().mockResolvedValue({ id: "mock-id" });
  const mockCreateMany = vi.fn().mockResolvedValue({ count: 1 });
  const mockFindFirst = vi.fn() as ReturnType<typeof vi.fn>;
  const mockFindMany = vi.fn() as ReturnType<typeof vi.fn>;
  const mockUpdate = vi.fn() as ReturnType<typeof vi.fn>;
  const mockUpdateMany = vi.fn() as ReturnType<typeof vi.fn>;
  const mockCount = vi.fn() as ReturnType<typeof vi.fn>;
  const mockGroupBy = vi.fn() as ReturnType<typeof vi.fn>;

  const lineCreate = vi.fn().mockImplementation((args: { data: { productId: string } }) => ({
    id: `line-${args.data.productId}`,
    ...args.data,
  }));

  const tx = {
    inventoryTransaction: { create: mockCreate, createMany: mockCreateMany, findFirst: mockFindFirst, findMany: mockFindMany, update: mockUpdate, updateMany: mockUpdateMany, count: mockCount, groupBy: mockGroupBy },
    inventoryTransactionLine: { create: lineCreate, createMany: mockCreateMany, findFirst: mockFindFirst, findMany: mockFindMany, update: mockUpdate, updateMany: mockUpdateMany, count: mockCount, groupBy: mockGroupBy },
    inventoryLedgerEntry: { create: mockCreate, createMany: mockCreateMany, findFirst: mockFindFirst, findMany: mockFindMany, update: mockUpdate, updateMany: mockUpdateMany, count: mockCount, groupBy: mockGroupBy },
  };

  return { mockTx: tx };
});

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    inventoryTransaction: mockTx.inventoryTransaction,
    inventoryTransactionLine: mockTx.inventoryTransactionLine,
    inventoryLedgerEntry: mockTx.inventoryLedgerEntry,
    $transaction: vi.fn((fn: (t: unknown) => Promise<unknown>) => fn(mockTx)),
  },
}));

import { InventoryPostingService } from "@/domains/inventory/services/inventory-posting-service";

describe("InventoryPostingService.post() — cost field passthrough", () => {
  let service: InventoryPostingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new InventoryPostingService();
  });

  const validInput = {
    organizationId: "org-1",
    type: "PURCHASE_RECEIPT" as const,
    createdById: "user-1",
    lines: [
      {
        productId: "prod-1",
        unitOfMeasureId: "uom-1",
        quantity: new Prisma.Decimal(10),
        notes: null,
        ledgerEntries: [
          {
            warehouseId: "wh-1",
            movementType: "PURCHASE_RECEIPT" as const,
            direction: "IN" as const,
            quantity: new Prisma.Decimal(10),
          },
        ],
      },
    ],
  };

  it("creates transaction and returns result when cost fields omitted", async () => {
    mockTx.inventoryTransaction.findFirst.mockResolvedValue({ id: "txn-1" });

    const result = await service.post(validInput);

    expect(result).toEqual({ id: "txn-1" });
    expect(mockTx.inventoryTransaction.create).toHaveBeenCalledTimes(1);
    expect(mockTx.inventoryTransactionLine.create).toHaveBeenCalledTimes(1);
    expect(mockTx.inventoryLedgerEntry.createMany).toHaveBeenCalledTimes(1);
  });

  it("stores unitCost=null when cost fields omitted on line", async () => {
    mockTx.inventoryTransaction.findFirst.mockResolvedValue({ id: "txn-1" });

    await service.post(validInput);

    expect(mockTx.inventoryTransactionLine.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          unitCost: null,
          totalCost: null,
        }),
      }),
    );
  });

  it("stores unitCost=undefined when cost fields omitted on ledger entry", async () => {
    mockTx.inventoryTransaction.findFirst.mockResolvedValue({ id: "txn-1" });

    await service.post(validInput);

    const callArgs = mockTx.inventoryLedgerEntry.createMany.mock.calls[0][0];
    expect(callArgs.data[0]).toHaveProperty("unitCost", undefined);
    expect(callArgs.data[0]).toHaveProperty("totalCost", undefined);
  });

  it("passes unitCost/totalCost when provided on transaction line", async () => {
    mockTx.inventoryTransaction.findFirst.mockResolvedValue({ id: "txn-2" });

    await service.post({
      ...validInput,
      lines: [
        {
          ...validInput.lines[0],
          unitCost: new Prisma.Decimal(5),
          totalCost: new Prisma.Decimal(50),
        },
      ],
    });

    expect(mockTx.inventoryTransactionLine.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          unitCost: new Prisma.Decimal(5),
          totalCost: new Prisma.Decimal(50),
        }),
      }),
    );
  });

  it("passes unitCost/totalCost when provided on ledger entry", async () => {
    mockTx.inventoryTransaction.findFirst.mockResolvedValue({ id: "txn-3" });

    await service.post({
      ...validInput,
      lines: [
        {
          ...validInput.lines[0],
          ledgerEntries: [
            {
              ...validInput.lines[0].ledgerEntries[0],
              unitCost: new Prisma.Decimal(5),
              totalCost: new Prisma.Decimal(50),
            },
          ],
        },
      ],
    });

    const callArgs = mockTx.inventoryLedgerEntry.createMany.mock.calls[0][0];
    expect(callArgs.data[0].unitCost).toEqual(new Prisma.Decimal(5));
    expect(callArgs.data[0].totalCost).toEqual(new Prisma.Decimal(50));
  });

  it("validates quantities but ignores cost fields", async () => {
    mockTx.inventoryTransaction.findFirst.mockResolvedValue({ id: "txn-4" });

    await expect(
      service.post({
        ...validInput,
        lines: [
          {
            ...validInput.lines[0],
            quantity: new Prisma.Decimal(-1),
          },
        ],
      }),
    ).rejects.toThrow("Inventory quantity must be greater than zero");
  });

  it("rejects zero quantity for non-LANDED_COST movement types", async () => {
    mockTx.inventoryTransaction.findFirst.mockResolvedValue({ id: "txn-5" });

    await expect(
      service.post({
        ...validInput,
        lines: [
          {
            ...validInput.lines[0],
            quantity: new Prisma.Decimal(0),
            ledgerEntries: [
              {
                ...validInput.lines[0].ledgerEntries[0],
                quantity: new Prisma.Decimal(0),
              },
            ],
          },
        ],
      }),
    ).rejects.toThrow("Inventory quantity must be greater than zero");
  });

  it("allows zero line quantity for LANDED_COST transactions", async () => {
    mockTx.inventoryTransaction.findFirst.mockResolvedValue({ id: "txn-6" });

    await expect(
      service.post({
        ...validInput,
        type: "LANDED_COST" as const,
        lines: [
          {
            ...validInput.lines[0],
            quantity: new Prisma.Decimal(0),
            ledgerEntries: [
              {
                ...validInput.lines[0].ledgerEntries[0],
                movementType: "LANDED_COST" as const,
                quantity: new Prisma.Decimal(0),
              },
            ],
          },
        ],
      }),
    ).resolves.toEqual({ id: "txn-6" });
  });

  it("allows zero entry quantity only when the entry movement type is LANDED_COST", async () => {
    mockTx.inventoryTransaction.findFirst.mockResolvedValue({ id: "txn-7" });

    await expect(
      service.post({
        ...validInput,
        type: "LANDED_COST" as const,
        lines: [
          {
            ...validInput.lines[0],
            quantity: new Prisma.Decimal(0),
            ledgerEntries: [
              {
                ...validInput.lines[0].ledgerEntries[0],
                movementType: "PURCHASE_RECEIPT" as const,
                quantity: new Prisma.Decimal(0),
              },
            ],
          },
        ],
      }),
    ).rejects.toThrow("Inventory quantity must be greater than zero");
  });

  it("rejects negative quantity for LANDED_COST transactions", async () => {
    mockTx.inventoryTransaction.findFirst.mockResolvedValue({ id: "txn-8" });

    await expect(
      service.post({
        ...validInput,
        type: "LANDED_COST" as const,
        lines: [
          {
            ...validInput.lines[0],
            quantity: new Prisma.Decimal(-1),
            ledgerEntries: [
              {
                ...validInput.lines[0].ledgerEntries[0],
                movementType: "LANDED_COST" as const,
                quantity: new Prisma.Decimal(-1),
              },
            ],
          },
        ],
      }),
    ).rejects.toThrow("Inventory quantity must not be negative");
  });
});
