import { vi } from "vitest";

function mockModel() {
  return {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    deleteMany: vi.fn(),
  };
}

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    invoice: mockModel(),
    payment: mockModel(),
    salesOrder: mockModel(),
    salesOrderLine: mockModel(),
    product: mockModel(),
    shipment: mockModel(),
    shipmentLine: mockModel(),
    activityLog: mockModel(),
    warehouse: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn({ invoice: mockModel(), salesOrder: mockModel(), salesOrderLine: mockModel(), shipment: mockModel() })),
  } as never,
}));
