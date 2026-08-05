import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const attachment = {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  };
  return { mockPrisma: { attachment } };
});

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: mockPrisma,
}));

import { AttachmentService } from "@/domains/attachments/services/attachment-service";
import { LocalStorageProvider } from "@/domains/attachments/providers/local-storage-provider";
import type { StorageProvider } from "@/domains/attachments/providers/storage-provider";

function mockContext(overrides = {}) {
  return {
    organizationId: "org-1",
    userId: "user-1",
    role: "MANAGER",
    ...overrides,
  } as never;
}

function makeAttachmentRow(overrides = {}) {
  return {
    id: "att-1",
    organizationId: "org-1",
    uploadedById: "user-1",
    entityType: "SupplierInvoice",
    entityId: "si-1",
    fileName: "invoice.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1024,
    provider: "LOCAL",
    storageKey: "uploads/attachments/org-1/SupplierInvoice/si-1/abc.pdf",
    createdAt: new Date("2026-08-04T10:00:00Z"),
    archivedAt: null,
    uploadedBy: { id: "user-1", name: "Test User", email: "test@example.com" },
    ...overrides,
  };
}

describe("AttachmentService", () => {
  let service: AttachmentService;
  let fakeProvider: StorageProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    fakeProvider = {
      name: "LOCAL",
      save: vi.fn(async () => ({ storageKey: "uploads/attachments/org-1/SupplierInvoice/si-1/abc.pdf", sizeBytes: 1024 })),
      read: vi.fn(async () => Buffer.from("pdf-data")),
      delete: vi.fn(async () => {}),
      getUrl: vi.fn(() => "/api/uploads/uploads/attachments/org-1/SupplierInvoice/si-1/abc.pdf"),
    };
    const registry = { get: () => fakeProvider } as unknown as LocalStorageProvider as never;
    service = new AttachmentService(undefined, registry, 10 * 1024 * 1024);
  });

  describe("upload", () => {
    it("stores bytes via provider and records metadata", async () => {
      mockPrisma.attachment.create.mockResolvedValue(makeAttachmentRow());

      const result = await service.upload(mockContext(), {
        entityType: "SupplierInvoice",
        entityId: "si-1",
        fileName: "invoice.pdf",
        mimeType: "application/pdf",
        data: Buffer.from("pdf-data"),
      });

      expect(fakeProvider.save).toHaveBeenCalledWith(expect.objectContaining({
        organizationId: "org-1",
        entityType: "SupplierInvoice",
        entityId: "si-1",
        data: Buffer.from("pdf-data"),
      }));
      expect(mockPrisma.attachment.create).toHaveBeenCalledWith({ data: expect.objectContaining({
        organizationId: "org-1",
        uploadedById: "user-1",
        entityType: "SupplierInvoice",
        entityId: "si-1",
        fileName: "invoice.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        provider: "LOCAL",
      }) });
      expect(result.url).toBe("/api/uploads/uploads/attachments/org-1/SupplierInvoice/si-1/abc.pdf");
    });
  });

  describe("list", () => {
    it("returns attachments with urls", async () => {
      mockPrisma.attachment.findMany.mockResolvedValue([makeAttachmentRow()]);

      const result = await service.list(mockContext(), "SupplierInvoice", "si-1");

      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe("invoice.pdf");
      expect(result[0].url).toBe("/api/uploads/uploads/attachments/org-1/SupplierInvoice/si-1/abc.pdf");
    });
  });

  describe("getFile", () => {
    it("returns file data through the provider", async () => {
      mockPrisma.attachment.findFirst.mockResolvedValue(makeAttachmentRow());

      const result = await service.getFile(mockContext(), "att-1");

      expect(fakeProvider.read).toHaveBeenCalledWith("uploads/attachments/org-1/SupplierInvoice/si-1/abc.pdf");
      expect(result.attachment.fileName).toBe("invoice.pdf");
      expect(result.data.toString()).toBe("pdf-data");
    });

    it("throws when the attachment is missing", async () => {
      mockPrisma.attachment.findFirst.mockResolvedValue(null);

      await expect(service.getFile(mockContext(), "missing")).rejects.toThrow("was not found");
    });
  });

  describe("remove", () => {
    it("deletes the file and archives the record", async () => {
      mockPrisma.attachment.findFirst.mockResolvedValue(makeAttachmentRow());

      await service.remove(mockContext(), "att-1");

      expect(fakeProvider.delete).toHaveBeenCalledWith("uploads/attachments/org-1/SupplierInvoice/si-1/abc.pdf");
      expect(mockPrisma.attachment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ archivedAt: expect.any(Date) }),
      }));
    });
  });
});
