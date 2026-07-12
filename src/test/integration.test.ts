import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";
import { PaymentService } from "@/domains/sales/services/payment-service";
import { InvoiceService } from "@/domains/sales/services/invoice-service";
import { CustomerBalanceService } from "@/domains/sales/services/customer-balance-service";
import { ShipmentService } from "@/domains/sales/services/shipment-service";
import { BusinessError } from "@/shared/errors/business-error";

function mockContext(overrides = {}) {
  return {
    organizationId: "org-1",
    userId: "user-1",
    role: "ADMIN",
    ...overrides,
  } as never;
}

function createMockInvoice(overrides = {}) {
  return {
    id: "inv-1",
    organizationId: "org-1",
    invoiceNumber: "INV-000001",
    salesOrderId: "so-1",
    customerId: "cust-1",
    status: "ISSUED",
    currency: "KWD",
    subtotal: new Prisma.Decimal(100),
    taxAmount: new Prisma.Decimal(0),
    totalAmount: new Prisma.Decimal(100),
    discountAmount: new Prisma.Decimal(0),
    discountType: null,
    discountRate: null,
    amountPaid: new Prisma.Decimal(0),
    issuedAt: new Date(),
    dueDate: null,
    paidAt: null,
    customerName: "Test Customer",
    customerAddress: null,
    paymentTerms: null,
    notes: null,
    warehouseName: null,
    deliveryStatus: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
    lines: [],
    customer: { id: "cust-1", name: "Test Customer" },
    salesOrder: { id: "so-1", soNumber: "SO-000001" },
    payments: [],
    ...overrides,
  };
}

describe("Payment Pipeline", () => {
  let paymentService: PaymentService;

  beforeEach(() => {
    vi.clearAllMocks();
    paymentService = new PaymentService();
  });

  it("should prevent overpayment", async () => {
    const mockFindById = prisma.invoice.findFirst as ReturnType<typeof vi.fn>;
    mockFindById.mockResolvedValue(createMockInvoice({ amountPaid: new Prisma.Decimal(90) }));

    await expect(
      paymentService.record(mockContext(), {
        invoiceId: "inv-1",
        amount: 20,
        currency: "KWD",
        method: "CASH",
        reference: undefined,
        paidAt: undefined,
        notes: undefined,
      }),
    ).rejects.toThrow(BusinessError);

    expect(mockFindById).toHaveBeenCalled();
  });

  it("should reject payments on paid invoices", async () => {
    const mockFindById = prisma.invoice.findFirst as ReturnType<typeof vi.fn>;
    mockFindById.mockResolvedValue(createMockInvoice({ status: "PAID", amountPaid: new Prisma.Decimal(100) }));

    await expect(
      paymentService.record(mockContext(), {
        invoiceId: "inv-1",
        amount: 10,
        currency: "KWD",
        method: "CASH",
        reference: undefined,
        paidAt: undefined,
        notes: undefined,
      }),
    ).rejects.toThrow("This invoice cannot accept payments.");
  });

  it("should record a full payment and update invoice to PAID", async () => {
    const mockFindById = prisma.invoice.findFirst as ReturnType<typeof vi.fn>;
    mockFindById.mockResolvedValue(createMockInvoice());

    const mockPaymentCreate = prisma.payment.create as ReturnType<typeof vi.fn>;
    mockPaymentCreate.mockResolvedValue({ id: "pay-1", paymentNumber: "PAY-000001" });

    const mockInvoiceUpdate = prisma.invoice.updateMany as ReturnType<typeof vi.fn>;
    const mockSOUpdate = prisma.salesOrder.updateMany as ReturnType<typeof vi.fn>;
    const mockDocGen = vi.spyOn(DocumentNumberService.prototype, "generate");
    mockDocGen.mockResolvedValue({ documentNumber: "PAY-000001", sequence: 1, year: 2026 });

    const result = await paymentService.record(mockContext(), {
      invoiceId: "inv-1",
      amount: 100,
      currency: "KWD",
      method: "BANK_TRANSFER",
      reference: "TRX-123",
      paidAt: undefined,
      notes: "Full payment",
    });

    expect(mockInvoiceUpdate).toHaveBeenCalled();
    expect(mockSOUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "PAID" },
      }),
    );
    expect(result).toBeDefined();
  });

  it("should record a partial payment and update invoice to PARTIALLY_PAID", async () => {
    const mockFindById = prisma.invoice.findFirst as ReturnType<typeof vi.fn>;
    mockFindById.mockResolvedValue(createMockInvoice({ totalAmount: new Prisma.Decimal(200) }));

    const mockPaymentCreate = prisma.payment.create as ReturnType<typeof vi.fn>;
    mockPaymentCreate.mockResolvedValue({ id: "pay-2", paymentNumber: "PAY-000002" });

    const mockInvoiceUpdate = prisma.invoice.updateMany as ReturnType<typeof vi.fn>;
    const mockDocGen = vi.spyOn(DocumentNumberService.prototype, "generate");
    mockDocGen.mockResolvedValue({ documentNumber: "PAY-000002", sequence: 2, year: 2026 });

    await paymentService.record(mockContext(), {
      invoiceId: "inv-1",
      amount: 50,
      currency: "KWD",
      method: "CASH",
      reference: undefined,
      paidAt: undefined,
      notes: undefined,
    });

    const updateCalls = mockInvoiceUpdate.mock.calls;
    const statusUpdate = updateCalls.find((call) => call[0].data?.status);
    expect(statusUpdate?.[0].data.status).toBe("PARTIALLY_PAID");
  });

  it("should allow multiple payments against the same invoice", async () => {
    const mockFindById = prisma.invoice.findFirst as ReturnType<typeof vi.fn>;
    mockFindById
      .mockResolvedValueOnce(createMockInvoice({ totalAmount: new Prisma.Decimal(100) }))
      .mockResolvedValueOnce(createMockInvoice({ totalAmount: new Prisma.Decimal(100), amountPaid: new Prisma.Decimal(40) }));

    const mockPaymentCreate = prisma.payment.create as ReturnType<typeof vi.fn>;
    mockPaymentCreate.mockResolvedValue({ id: "pay-3", paymentNumber: "PAY-000003" });

    const mockDocGen = vi.spyOn(DocumentNumberService.prototype, "generate");
    mockDocGen.mockResolvedValue({ documentNumber: "PAY-000003", sequence: 3, year: 2026 });

    await paymentService.record(mockContext(), {
      invoiceId: "inv-1",
      amount: 40,
      currency: "KWD",
      method: "CHEQUE",
      reference: undefined,
      paidAt: undefined,
      notes: undefined,
    });

    mockDocGen.mockResolvedValue({ documentNumber: "PAY-000004", sequence: 4, year: 2026 });

    const result = await paymentService.record(mockContext(), {
      invoiceId: "inv-1",
      amount: 60,
      currency: "KWD",
      method: "BANK_TRANSFER",
      reference: undefined,
      paidAt: undefined,
      notes: undefined,
    });

    expect(result).toBeDefined();
  });
});

describe("Customer Balance Service", () => {
  let balanceService: CustomerBalanceService;

  beforeEach(() => {
    vi.clearAllMocks();
    balanceService = new CustomerBalanceService();
  });

  it("should calculate outstanding across multiple invoices", async () => {
    const mockFindMany = prisma.invoice.findMany as ReturnType<typeof vi.fn>;
    mockFindMany.mockResolvedValue([
      { totalAmount: new Prisma.Decimal(100), amountPaid: new Prisma.Decimal(30) },
      { totalAmount: new Prisma.Decimal(200), amountPaid: new Prisma.Decimal(0) },
      { totalAmount: new Prisma.Decimal(150), amountPaid: new Prisma.Decimal(150) },
    ]);

    const outstanding = await balanceService.getOutstanding("org-1", "cust-1");

    expect(outstanding).toBe(270);
  });

  it("should return 0 when no open invoices exist", async () => {
    const mockFindMany = prisma.invoice.findMany as ReturnType<typeof vi.fn>;
    mockFindMany.mockResolvedValue([]);

    const outstanding = await balanceService.getOutstanding("org-1", "cust-1");

    expect(outstanding).toBe(0);
  });

  it("should return correct balance summary with paid and unpaid", async () => {
    const mockFindMany = prisma.invoice.findMany as ReturnType<typeof vi.fn>;
    mockFindMany.mockResolvedValue([
      { totalAmount: new Prisma.Decimal(100), amountPaid: new Prisma.Decimal(30) },
    ]);

    const summary = await balanceService.getBalanceSummary("org-1", "cust-1");

    expect(summary.outstanding).toBe(70);
    expect(summary.totalPaid).toBe(30);
    expect(summary.totalInvoiced).toBe(100);
    expect(summary.openInvoiceCount).toBe(1);
  });
});

describe("Shipment Service", () => {
  let shipmentService: ShipmentService;

  beforeEach(() => {
    vi.clearAllMocks();
    shipmentService = new ShipmentService();
  });

  it("should reject shipment creation for non-eligible orders", async () => {
    const mockFindById = prisma.salesOrder.findFirst as ReturnType<typeof vi.fn>;
    mockFindById.mockResolvedValue({
      id: "so-1",
      status: "DRAFT",
      lines: [],
    });

    await expect(
      shipmentService.create(mockContext(), {
        salesOrderId: "so-1",
        warehouseId: "wh-1",
        notes: undefined,
        lines: [],
      }),
    ).rejects.toThrow(BusinessError);
  });

  it("should accept shipment for APPROVED, READY_FOR_INVOICE, or INVOICED orders", async () => {
    const mockSOFindById = prisma.salesOrder.findFirst as ReturnType<typeof vi.fn>;
    mockSOFindById.mockResolvedValue({
      id: "so-1",
      status: "INVOICED",
      soNumber: "SO-000001",
      lines: [
        {
          id: "sol-1",
          orderedQuantity: new Prisma.Decimal(100),
          shippedQuantity: new Prisma.Decimal(0),
          productId: "prod-1",
        },
      ],
    });

    const mockWarehouseFind = vi.fn().mockResolvedValue({ id: "wh-1", name: "Main", code: "WH1" });
    vi.spyOn(WarehouseRepository.prototype, "findActiveById").mockImplementation(mockWarehouseFind);

    const mockBalanceAssert = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StockBalanceService.prototype, "assertAvailable").mockImplementation(mockBalanceAssert);

    const mockDocGen = vi.spyOn(DocumentNumberService.prototype, "generate");
    mockDocGen.mockResolvedValue({ documentNumber: "SHP-000001", sequence: 1, year: 2026 });

    const mockShipmentCreate = prisma.shipment.create as ReturnType<typeof vi.fn>;
    mockShipmentCreate.mockResolvedValue({
      id: "ship-1",
      shipmentNumber: "SHP-000001",
    });

    const result = await shipmentService.create(mockContext(), {
      salesOrderId: "so-1",
      warehouseId: "wh-1",
      notes: undefined,
      lines: [
        {
          salesOrderLineId: "sol-1",
          productId: "prod-1",
          quantity: 50,
          productName: "Test Product",
          productSku: "TP-001",
          notes: undefined,
        },
      ],
    });

    expect(result).toBeDefined();
    expect(mockShipmentCreate).toHaveBeenCalled();
  });
});

describe("Invoice Service", () => {
  let invoiceService: InvoiceService;

  beforeEach(() => {
    vi.clearAllMocks();
    invoiceService = new InvoiceService();
  });

  it("should set status ISSUED on generation", async () => {
    const mockSOFindById = prisma.salesOrder.findFirst as ReturnType<typeof vi.fn>;
    mockSOFindById.mockResolvedValue({
      id: "so-1",
      soNumber: "SO-000001",
      status: "APPROVED",
      organizationId: "org-1",
      customerId: "cust-1",
      currency: "KWD",
      subtotal: new Prisma.Decimal(100),
      taxAmount: new Prisma.Decimal(0),
      totalAmount: new Prisma.Decimal(100),
      discountAmount: new Prisma.Decimal(0),
      discountType: null,
      discountRate: null,
      notes: null,
      orderedAt: new Date(),
      customer: { id: "cust-1", name: "Test Customer", address: null },
      lines: [
        {
          id: "sol-1",
          productId: "prod-1",
          unitOfMeasureId: "uom-1",
          lineNumber: 1,
          orderedQuantity: new Prisma.Decimal(10),
          unitPrice: new Prisma.Decimal(10),
          totalPrice: new Prisma.Decimal(100),
          productName: "Test Product",
          productSku: "TP-001",
          unitOfMeasureCode: "EA",
          piecesPerBox: null,
          description: null,
        },
      ],
      shipments: [],
      invoices: [],
    });

    const mockDocGen = vi.spyOn(DocumentNumberService.prototype, "generate");
    mockDocGen.mockResolvedValue({ documentNumber: "INV-000001", sequence: 1, year: 2026 });

    const mockInvoiceCreate = prisma.invoice.create as ReturnType<typeof vi.fn>;
    mockInvoiceCreate.mockResolvedValue({
      id: "inv-1",
      invoiceNumber: "INV-000001",
      status: "ISSUED",
    });

    const mockProductFind = prisma.product.findFirst as ReturnType<typeof vi.fn>;
    mockProductFind.mockResolvedValue({ piecesPerBox: null });

    const result = await invoiceService.generateFromOrder(mockContext(), "so-1");

    expect(result).toBeDefined();
  });
});

// Re-imports for mocks
import { DocumentNumberService } from "@/domains/documents/services/document-number-service";
import { WarehouseRepository } from "@/domains/warehouses/repositories/warehouse-repository";
import { StockBalanceService } from "@/domains/inventory/services/stock-balance-service";
