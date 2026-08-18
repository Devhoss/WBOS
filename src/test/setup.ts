import { vi } from "vitest";

function mockModel() {
  return {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findFirstOrThrow: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
    deleteMany: vi.fn(),
  };
}

/**
 * Any model accessed on the client gets a stable mock, created on first use.
 * Previously only a hand-listed set of models existed, so a service touching
 * anything else failed with "cannot read property of undefined" rather than a
 * meaningful assertion.
 */
function mockClient() {
  const models = new Map<string, ReturnType<typeof mockModel>>();

  const base: Record<string, unknown> = {
    // Conditional writes (`UPDATE ... WHERE <invariant>`) report affected rows.
    // Default 1 = "the invariant held and one row changed", which is the
    // happy path for a unit test. Tests that need the contended case override
    // this with mockResolvedValueOnce(0).
    $executeRaw: vi.fn().mockResolvedValue(1),
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
    $queryRaw: vi.fn().mockResolvedValue([]),
  };

  const handler: ProxyHandler<Record<string, unknown>> = {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      if (!models.has(prop)) models.set(prop, mockModel());
      return models.get(prop);
    },
  };

  const client = new Proxy(base, handler);

  // Transactions run the callback against a client of the same shape, so code
  // under test behaves identically inside and outside a transaction.
  base.$transaction = vi.fn((arg: unknown) =>
    typeof arg === "function"
      ? (arg as (tx: unknown) => Promise<unknown>)(client)
      : Promise.resolve(arg),
  );

  return client;
}

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: mockClient() as never,
}));
