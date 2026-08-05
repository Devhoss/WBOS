import { describe, it, expect, vi, beforeEach } from "vitest";

const { repoMock, activityLogRepositoryCreate, supplierFindById } = vi.hoisted(() => {
  const repoMock = {
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    findPurchaseOrderSummary: vi.fn(),
    findSupplierInvoiceSummary: vi.fn(),
    findLandedCostSummary: vi.fn(),
    findLinkByPurchaseOrder: vi.fn(),
    linkPurchaseOrder: vi.fn(),
    unlinkPurchaseOrder: vi.fn(),
    setSupplierInvoice: vi.fn(),
    setLandedCost: vi.fn(),
    archive: vi.fn(),
  };
  return { repoMock, activityLogRepositoryCreate: vi.fn(), supplierFindById: vi.fn() };
});

vi.mock("@/domains/suppliers/repositories/supplier-repository", () => ({
  SupplierRepository: class {
    findById = supplierFindById;
  },
}));

vi.mock("@/domains/documents/services/document-number-service", () => ({
  DocumentNumberService: class {
    generate = vi.fn(async () => ({
      documentNumber: "IMP-2026-000001",
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

vi.mock("@/domains/import-shipments/repositories/import-shipment-repository", () => ({
  ImportShipmentRepository: class {
    create = repoMock.create;
    findById = repoMock.findById;
    update = repoMock.update;
    findPurchaseOrderSummary = repoMock.findPurchaseOrderSummary;
    findSupplierInvoiceSummary = repoMock.findSupplierInvoiceSummary;
    findLandedCostSummary = repoMock.findLandedCostSummary;
    findLinkByPurchaseOrder = repoMock.findLinkByPurchaseOrder;
    linkPurchaseOrder = repoMock.linkPurchaseOrder;
    unlinkPurchaseOrder = repoMock.unlinkPurchaseOrder;
    setSupplierInvoice = repoMock.setSupplierInvoice;
    setLandedCost = repoMock.setLandedCost;
    archive = repoMock.archive;
  },
}));

import { ImportShipmentService } from "@/domains/import-shipments/services/import-shipment-service";
import { BusinessError } from "@/shared/errors/business-error";

function mockContext(overrides = {}) {
  return {
    organizationId: "org-1",
    userId: "user-1",
    role: "ADMIN",
    ...overrides,
  } as never;
}

function makeShipment(overrides = {}) {
  return {
    id: "imp-1",
    organizationId: "org-1",
    shipmentNumber: "IMP-2026-000001",
    supplierId: "sup-1",
    currency: "USD",
    containerRef: "MSKU1234567",
    vessel: null,
    portOfLoading: null,
    portOfDischarge: null,
    etd: null,
    eta: null,
    supplierInvoiceId: null,
    landedCostId: null,
    notes: null,
    createdById: "user-1",
    createdAt: new Date("2026-08-04T10:00:00Z"),
    updatedAt: new Date("2026-08-04T10:00:00Z"),
    archivedAt: null,
    supplier: { id: "sup-1", name: "Overseas Supplier" },
    createdBy: { id: "user-1", name: "Test User", email: "test@example.com" },
    purchaseOrderLinks: [],
    supplierInvoice: null,
    landedCost: null,
    ...overrides,
  };
}

describe("ImportShipmentService", () => {
  let service: ImportShipmentService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ImportShipmentService();
  });

  describe("create", () => {
    it("creates a shipment with an IMP number and logs activity", async () => {
      supplierFindById.mockResolvedValue({ id: "sup-1", name: "Overseas Supplier", archivedAt: null } as never);
      repoMock.create.mockResolvedValue(makeShipment());

      const result = await service.create(mockContext(), {
        supplierId: "sup-1",
        currency: "USD",
        containerRef: "MSKU1234567",
        notes: undefined,
      });

      expect(result.shipmentNumber).toBe("IMP-2026-000001");
      expect(repoMock.create).toHaveBeenCalledWith("org-1", "IMP-2026-000001", "user-1", expect.anything());
      expect(activityLogRepositoryCreate).toHaveBeenCalledWith(expect.objectContaining({
        action: "IMPORT_SHIPMENT_CREATED",
      }));
    });
  });

  describe("linkPurchaseOrder", () => {
    it("links a matching purchase order", async () => {
      repoMock.findById.mockResolvedValue(makeShipment());
      repoMock.findPurchaseOrderSummary.mockResolvedValue({
        id: "po-1", poNumber: "PO-2026-0001", status: "APPROVED", supplierId: "sup-1", archivedAt: null,
      });
      repoMock.findLinkByPurchaseOrder.mockResolvedValue(null);

      await service.linkPurchaseOrder(mockContext(), { importShipmentId: "imp-1", purchaseOrderId: "po-1" });

      expect(repoMock.linkPurchaseOrder).toHaveBeenCalledWith("org-1", "imp-1", "po-1");
    });

    it("rejects a purchase order from a different supplier", async () => {
      repoMock.findById.mockResolvedValue(makeShipment());
      repoMock.findPurchaseOrderSummary.mockResolvedValue({
        id: "po-2", poNumber: "PO-2", status: "APPROVED", supplierId: "other", archivedAt: null,
      });

      await expect(
        service.linkPurchaseOrder(mockContext(), { importShipmentId: "imp-1", purchaseOrderId: "po-2" }),
      ).rejects.toThrow("different supplier");
    });

    it("rejects a purchase order already linked elsewhere", async () => {
      repoMock.findById.mockResolvedValue(makeShipment());
      repoMock.findPurchaseOrderSummary.mockResolvedValue({
        id: "po-1", poNumber: "PO-1", status: "APPROVED", supplierId: "sup-1", archivedAt: null,
      });
      repoMock.findLinkByPurchaseOrder.mockResolvedValue({ id: "link-1" } as never);

      await expect(
        service.linkPurchaseOrder(mockContext(), { importShipmentId: "imp-1", purchaseOrderId: "po-1" }),
      ).rejects.toThrow("already linked");
    });
  });

  describe("linkSupplierInvoice", () => {
    it("rejects an archived supplier invoice", async () => {
      repoMock.findById.mockResolvedValue(makeShipment());
      repoMock.findSupplierInvoiceSummary.mockResolvedValue({
        id: "si-1", siNumber: "SIV-1", status: "ISSUED", supplierId: "sup-1", archivedAt: new Date(),
      });

      await expect(
        service.linkSupplierInvoice(mockContext(), { importShipmentId: "imp-1", supplierInvoiceId: "si-1" }),
      ).rejects.toThrow("archived");
    });

    it("links a valid supplier invoice", async () => {
      repoMock.findById.mockResolvedValue(makeShipment());
      repoMock.findSupplierInvoiceSummary.mockResolvedValue({
        id: "si-1", siNumber: "SIV-1", status: "ISSUED", supplierId: "sup-1", archivedAt: null,
      });

      await service.linkSupplierInvoice(mockContext(), { importShipmentId: "imp-1", supplierInvoiceId: "si-1" });

      expect(repoMock.setSupplierInvoice).toHaveBeenCalledWith("org-1", "imp-1", "si-1");
    });
  });

  describe("linkLandedCost", () => {
    it("rejects a cancelled landed cost", async () => {
      repoMock.findById.mockResolvedValue(makeShipment());
      repoMock.findLandedCostSummary.mockResolvedValue({
        id: "lc-1", lcNumber: "LC-1", status: "CANCELLED", supplierId: "sup-1",
      });

      await expect(
        service.linkLandedCost(mockContext(), { importShipmentId: "imp-1", landedCostId: "lc-1" }),
      ).rejects.toThrow("cancelled");
      expect(repoMock.setLandedCost).not.toHaveBeenCalled();
    });
  });

  describe("archive", () => {
    it("archives a shipment and logs activity", async () => {
      repoMock.findById.mockResolvedValue(makeShipment());

      await service.archive(mockContext(), "imp-1");

      expect(repoMock.archive).toHaveBeenCalledWith("org-1", "imp-1");
      expect(activityLogRepositoryCreate).toHaveBeenCalledWith(expect.objectContaining({
        action: "IMPORT_SHIPMENT_ARCHIVED",
      }));
    });

    it("rejects double archive", async () => {
      repoMock.findById.mockResolvedValue(makeShipment({ archivedAt: new Date() }));

      await expect(service.archive(mockContext(), "imp-1")).rejects.toThrow(BusinessError);
    });
  });
});