import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const { mockPrisma, activityLogRepositoryCreate } = vi.hoisted(() => {
  const supplierInvoice = {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  };
  const supplierInvoicePayment = {
    create: vi.fn(),
  };
  const supplier = {
    findById: vi.fn(),
  };
  const documentSequence = {
    upsert: vi.fn(),
  };
  const activityLog = {
    create: vi.fn(),
  };
  const activityLogRepositoryCreate = vi.fn();

  return {
    mockPrisma: {
      supplierInvoice,
      supplierInvoicePayment,
      supplier,
      documentSequence,
      activityLog,
    },
    activityLogRepositoryCreate,
  };
});

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/domains/suppliers/repositories/supplier-repository", () => ({
  SupplierRepository: class {
    findById = mockPrisma.supplier.findById;
  },
}));

vi.mock("@/domains/documents/services/document-number-service", () => ({
  DocumentNumberService: class {
    generate = vi.fn(async (input: { documentType: string }) => ({
      documentNumber: input.documentType === "SIV" ? "SIV-2026-000001" : "PAY-2026-000001",
      sequence: 1,
      year: 2026,
    }));
  },
}));

vi.mock("@/domains/activity/repositories/activity-log-repository", () => ({
  ActivityLogRepository: class {
    create = activityLogRepositoryCreate;
  },
}));

import { SupplierInvoiceService } from "@/domains/supplier-invoices/services/supplier-invoice-service";
import { BusinessError } from "@/shared/errors/business-error";

const D = (v: number | string) => new Prisma.Decimal(v);

function mockContext(overrides = {}) {
  return {
    organizationId: "org-1",
    userId: "user-1",
    role: "ADMIN",
    ...overrides,
  } as never;
}

function makeInvoice(overrides = {}) {
  return {
    id: "si-1",
    organizationId: "org-1",
    siNumber: "SIV-2026-000001",
    supplierId: "sup-1",
    status: "ISSUED",
    currency: "KWD",
    subtotal: D(100),
    taxAmount: D(0),
    totalAmount: D(100),
    amountPaid: D(0),
    reference: null,
    dueDate: null,
    issuedAt: null,
    paidAt: null,
    notes: null,
    createdById: "user-1",
    createdAt: new Date("2026-08-04T10:00:00Z"),
    updatedAt: new Date("2026-08-04T10:00:00Z"),
    archivedAt: null,
    supplier: { id: "sup-1", name: "Supplier A" },
    createdBy: { id: "user-1", name: "Test User" },
    payments: [],
    ...overrides,
  };
}

describe("SupplierInvoiceService", () => {
  let service: SupplierInvoiceService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SupplierInvoiceService();
  });

  describe("create", () => {
    it("creates a draft invoice and logs activity", async () => {
      mockPrisma.supplier.findById.mockResolvedValue({ id: "sup-1", name: "Supplier A" });
      mockPrisma.supplierInvoice.create.mockResolvedValue(makeInvoice({ status: "DRAFT" }));

      const result = await service.create(mockContext(), {
        supplierId: "sup-1",
        currency: "KWD",
        subtotal: 100,
        taxAmount: 0,
        totalAmount: 100,
        reference: undefined,
        dueDate: undefined,
        notes: undefined,
      });

      expect(result.status).toBe("DRAFT");
      expect(mockPrisma.supplierInvoice.create).toHaveBeenCalled();
      expect(activityLogRepositoryCreate).toHaveBeenCalledWith(expect.objectContaining({
        action: "SUPPLIER_INVOICE_CREATED",
      }));
    });

    it("rejects an unknown supplier", async () => {
      mockPrisma.supplier.findById.mockResolvedValue(null);

      await expect(
        service.create(mockContext(), {
          supplierId: "missing",
          currency: "KWD",
          subtotal: 100,
          taxAmount: 0,
          totalAmount: 100,
        }),
      ).rejects.toThrow(BusinessError);
    });
  });

  describe("update", () => {
    it("only allows editing drafts", async () => {
      mockPrisma.supplierInvoice.findFirst.mockResolvedValue(makeInvoice({ status: "ISSUED" }));

      await expect(
        service.update(mockContext(), { id: "si-1", supplierId: "sup-1", currency: "KWD", subtotal: 100, taxAmount: 0, totalAmount: 100 }),
      ).rejects.toThrow("Only draft supplier invoices can be edited.");
    });

    it("updates a draft invoice", async () => {
      mockPrisma.supplierInvoice.findFirst.mockResolvedValue(makeInvoice({ status: "DRAFT" }));
      mockPrisma.supplierInvoice.update.mockResolvedValue(makeInvoice({ status: "DRAFT", subtotal: D(120), totalAmount: D(120) }));

      const result = await service.update(mockContext(), {
        id: "si-1", supplierId: "sup-1", currency: "KWD", subtotal: 120, taxAmount: 0, totalAmount: 120,
      });

      expect(result.totalAmount).toEqual(D(120));
      expect(mockPrisma.supplierInvoice.update).toHaveBeenCalled();
    });
  });

  describe("issue", () => {
    it("issues a draft invoice", async () => {
      mockPrisma.supplierInvoice.findFirst.mockResolvedValue(makeInvoice({ status: "DRAFT" }));

      await service.issue(mockContext(), "si-1");

      expect(mockPrisma.supplierInvoice.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: "ISSUED" }),
      }));
      expect(activityLogRepositoryCreate).toHaveBeenCalledWith(expect.objectContaining({
        action: "SUPPLIER_INVOICE_ISSUED",
      }));
    });

    it("rejects issuing a non-draft", async () => {
      mockPrisma.supplierInvoice.findFirst.mockResolvedValue(makeInvoice({ status: "PAID" }));

      await expect(service.issue(mockContext(), "si-1")).rejects.toThrow(BusinessError);
    });
  });

  describe("recordPayment", () => {
    it("records a deposit and transitions to PARTIALLY_PAID", async () => {
      mockPrisma.supplierInvoice.findFirst.mockResolvedValue(makeInvoice({ status: "ISSUED" }));
      mockPrisma.supplierInvoicePayment.create.mockResolvedValue({
        id: "sp-1", paymentNumber: "PAY-2026-000001", amount: D(50),
      });

      await service.recordPayment(mockContext(), {
        supplierInvoiceId: "si-1",
        amount: 50,
        currency: "KWD",
        method: "BANK_TRANSFER",
        reference: undefined,
        paidAt: undefined,
        notes: undefined,
      });

      expect(mockPrisma.supplierInvoice.updateMany).toHaveBeenCalledTimes(2);
      expect(mockPrisma.supplierInvoice.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: { status: "PARTIALLY_PAID" },
      }));
      expect(activityLogRepositoryCreate).toHaveBeenCalledWith(expect.objectContaining({
        action: "SUPPLIER_INVOICE_PAYMENT_RECORDED",
      }));
    });

    it("marks PAID when fully covered", async () => {
      mockPrisma.supplierInvoice.findFirst.mockResolvedValue(makeInvoice({ status: "PARTIALLY_PAID", amountPaid: D(50) }));
      mockPrisma.supplierInvoicePayment.create.mockResolvedValue({
        id: "sp-2", paymentNumber: "PAY-2026-000002", amount: D(50),
      });

      await service.recordPayment(mockContext(), {
        supplierInvoiceId: "si-1",
        amount: 50,
        currency: "KWD",
        method: "CASH",
        reference: undefined,
        paidAt: undefined,
        notes: undefined,
      });

      expect(mockPrisma.supplierInvoice.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: "PAID", paidAt: expect.any(Date) }),
      }));
    });

    it("rejects overpayment", async () => {
      mockPrisma.supplierInvoice.findFirst.mockResolvedValue(makeInvoice({ amountPaid: D(90) }));

      await expect(
        service.recordPayment(mockContext(), {
          supplierInvoiceId: "si-1",
          amount: 20,
          currency: "KWD",
          method: "CASH",
          reference: undefined,
          paidAt: undefined,
          notes: undefined,
        }),
      ).rejects.toThrow("would exceed the outstanding balance");
    });

    it("rejects payments before issuance", async () => {
      mockPrisma.supplierInvoice.findFirst.mockResolvedValue(makeInvoice({ status: "DRAFT" }));

      await expect(
        service.recordPayment(mockContext(), {
          supplierInvoiceId: "si-1",
          amount: 10,
          currency: "KWD",
          method: "CASH",
          reference: undefined,
          paidAt: undefined,
          notes: undefined,
        }),
      ).rejects.toThrow("Issue the supplier invoice");
    });
  });

  describe("cancel", () => {
    it("cancels a draft invoice", async () => {
      mockPrisma.supplierInvoice.findFirst.mockResolvedValue(makeInvoice({ status: "DRAFT" }));

      await service.cancel(mockContext(), "si-1");

      expect(mockPrisma.supplierInvoice.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: { status: "CANCELLED" },
      }));
    });

    it("blocks cancellation once payments exist", async () => {
      mockPrisma.supplierInvoice.findFirst.mockResolvedValue(makeInvoice({
        status: "ISSUED",
        payments: [{ id: "sp-1", amount: D(50) }],
      }));

      await expect(service.cancel(mockContext(), "si-1")).rejects.toThrow("has recorded payments");
    });

    it("blocks cancellation of paid invoices", async () => {
      mockPrisma.supplierInvoice.findFirst.mockResolvedValue(makeInvoice({ status: "PAID" }));

      await expect(service.cancel(mockContext(), "si-1")).rejects.toThrow(BusinessError);
    });
  });

  describe("archive", () => {
    it("archives an invoice", async () => {
      mockPrisma.supplierInvoice.findFirst.mockResolvedValue(makeInvoice({ status: "PAID" }));

      await service.archive(mockContext(), "si-1");

      expect(mockPrisma.supplierInvoice.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ archivedAt: expect.any(Date) }),
      }));
    });

    it("rejects double archive", async () => {
      mockPrisma.supplierInvoice.findFirst.mockResolvedValue(makeInvoice({ archivedAt: new Date() }));

      await expect(service.archive(mockContext(), "si-1")).rejects.toThrow("already archived");
    });
  });
});

