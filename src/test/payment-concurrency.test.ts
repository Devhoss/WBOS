import { beforeEach, describe, expect, it, vi } from "vitest";

import { PaymentService } from "@/domains/sales/services/payment-service";
import { prisma } from "@/infrastructure/database/prisma";
import { BusinessError } from "@/shared/errors/business-error";

/**
 * Unit-level guards for payment recording.
 *
 * NOTE ON SCOPE — the concurrency proof for audit finding #2 lives in
 * `.e2e/concurrency-proof.e2e.test.ts` ("#2 concurrent payments cannot be lost
 * or overpay the invoice"), where two payments race against a real PostgreSQL.
 *
 * It was moved there deliberately. The fix replaced an absolute write
 * (`amountPaid = <value read earlier>`) with a conditional relative UPDATE
 * executed inside a transaction. A mocked Prisma client cannot evaluate a SQL
 * predicate, so asserting on mock call shapes here would only re-describe the
 * implementation rather than verify the invariant. The rule that matters —
 * `sum(payments) == invoice.amountPaid` and `amountPaid <= totalAmount` — is
 * asserted live against the database.
 *
 * What remains here are the pre-transaction validations, which are pure
 * decisions and genuinely unit-testable.
 */

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    invoice: { updateMany: vi.fn() },
    salesOrder: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const db = prisma as unknown as { $transaction: ReturnType<typeof vi.fn> };

function makeContext() {
  return {
    organizationId: "org-1",
    userId: "user-1",
    role: "FINANCE",
    user: { name: "Finance User" },
  } as never;
}

function buildService(invoice: unknown) {
  const invoices = { findById: vi.fn().mockResolvedValue(invoice) };
  const payments = { create: vi.fn() };
  const documents = { generate: vi.fn().mockResolvedValue({ documentNumber: "PAY-1" }) };
  const activityLogs = { create: vi.fn().mockResolvedValue({}) };

  return {
    service: new PaymentService(
      payments as never,
      invoices as never,
      documents as never,
      activityLogs as never,
    ),
    payments,
    documents,
  };
}

const PAYABLE = {
  id: "inv-1",
  organizationId: "org-1",
  invoiceNumber: "INV-1",
  customerId: "cust-1",
  salesOrderId: "so-1",
  status: "ISSUED",
  amountPaid: 0,
  totalAmount: 100,
};

describe("PaymentService.record — pre-transaction validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a payment against a missing invoice", async () => {
    const { service } = buildService(null);
    await expect(
      service.record(makeContext(), { invoiceId: "nope", amount: 10 } as never),
    ).rejects.toBeInstanceOf(BusinessError);
  });

  it.each(["PAID", "CANCELLED", "CREDITED"])(
    "refuses to accept a payment on a %s invoice",
    async (status) => {
      const { service, documents } = buildService({ ...PAYABLE, status });
      await expect(
        service.record(makeContext(), { invoiceId: "inv-1", amount: 10 } as never),
      ).rejects.toMatchObject({ code: "INVOICE_NOT_PAYABLE" });

      // Must fail before consuming a payment number.
      expect(documents.generate).not.toHaveBeenCalled();
    },
  );

  it("rejects an obvious overpayment before opening a transaction", async () => {
    const { service } = buildService({ ...PAYABLE, amountPaid: 90 });
    await expect(
      service.record(makeContext(), { invoiceId: "inv-1", amount: 50 } as never),
    ).rejects.toMatchObject({ code: "INVOICE_OVERPAYMENT" });

    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("performs the balance change inside a transaction", async () => {
    // Structural guarantee: a Payment row can never be persisted without the
    // matching balance update, because both happen in one transaction.
    const { service } = buildService(PAYABLE);
    db.$transaction.mockResolvedValue({ id: "pay-1" });

    await service.record(makeContext(), {
      invoiceId: "inv-1", amount: 25, currency: "KWD", method: "CASH",
    } as never);

    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("does not create the payment outside the transaction", async () => {
    // The old implementation wrote the Payment row via the repository before
    // touching the invoice, so a later failure orphaned it.
    const { service, payments } = buildService(PAYABLE);
    db.$transaction.mockResolvedValue({ id: "pay-1" });

    await service.record(makeContext(), {
      invoiceId: "inv-1", amount: 25, currency: "KWD", method: "CASH",
    } as never);

    expect(payments.create).not.toHaveBeenCalled();
  });
});
