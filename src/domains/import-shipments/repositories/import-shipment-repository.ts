import type { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";

import type {
  CreateImportShipmentInput,
  UpdateImportShipmentInput,
} from "../validation/import-shipment-schema";

const shipmentInclude = {
  supplier: { select: { id: true, name: true, code: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  purchaseOrderLinks: {
    include: {
      purchaseOrder: {
        select: {
          id: true,
          poNumber: true,
          status: true,
          totalAmount: true,
          orderedAt: true,
        },
      },
    },
  },
  supplierInvoice: {
    include: {
      supplier: { select: { id: true, name: true } },
      payments: { select: { id: true } },
    },
  },
  landedCost: {
    select: {
      id: true,
      lcNumber: true,
      status: true,
    },
  },
} satisfies Prisma.ImportShipmentInclude;

export class ImportShipmentRepository {
  async create(
    organizationId: string,
    shipmentNumber: string,
    createdById: string,
    input: CreateImportShipmentInput,
  ) {
    return prisma.importShipment.create({
      data: {
        organizationId,
        shipmentNumber,
        supplierId: input.supplierId,
        currency: input.currency,
        containerRef: input.containerRef,
        vessel: input.vessel,
        portOfLoading: input.portOfLoading,
        portOfDischarge: input.portOfDischarge,
        etd: input.etd,
        eta: input.eta,
        notes: input.notes,
        createdById,
      },
      include: shipmentInclude,
    });
  }

  async findById(organizationId: string, id: string) {
    return prisma.importShipment.findFirst({
      where: { id, organizationId },
      include: shipmentInclude,
    });
  }

  async update(organizationId: string, id: string, input: UpdateImportShipmentInput) {
    return prisma.importShipment.update({
      where: { id },
      data: {
        supplierId: input.supplierId,
        currency: input.currency,
        containerRef: input.containerRef,
        vessel: input.vessel,
        portOfLoading: input.portOfLoading,
        portOfDischarge: input.portOfDischarge,
        etd: input.etd,
        eta: input.eta,
        notes: input.notes,
      },
      include: shipmentInclude,
    });
  }

  async listWithFilters(
    organizationId: string,
    filters: {
      supplierId?: string;
      search?: string;
      page?: number;
      pageSize?: number;
      archived?: boolean;
    } = {},
  ) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 50;

    const where: Prisma.ImportShipmentWhereInput = { organizationId };

    if (filters.archived) {
      where.archivedAt = { not: null };
    } else {
      where.archivedAt = null;
    }

    if (filters.supplierId) {
      where.supplierId = filters.supplierId;
    }

    if (filters.search) {
      where.OR = [
        { shipmentNumber: { contains: filters.search, mode: "insensitive" } },
        { containerRef: { contains: filters.search, mode: "insensitive" } },
        { vessel: { contains: filters.search, mode: "insensitive" } },
        { supplier: { name: { contains: filters.search, mode: "insensitive" } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.importShipment.findMany({
        where,
        include: shipmentInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.importShipment.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async linkPurchaseOrder(organizationId: string, importShipmentId: string, purchaseOrderId: string) {
    return prisma.importShipmentPurchaseOrder.create({
      data: { organizationId, importShipmentId, purchaseOrderId },
    });
  }

  async unlinkPurchaseOrder(organizationId: string, importShipmentId: string, purchaseOrderId: string) {
    return prisma.importShipmentPurchaseOrder.deleteMany({
      where: { organizationId, importShipmentId, purchaseOrderId },
    });
  }

  async findLinkByPurchaseOrder(organizationId: string, purchaseOrderId: string) {
    return prisma.importShipmentPurchaseOrder.findFirst({
      where: { organizationId, purchaseOrderId },
    });
  }

  async setSupplierInvoice(organizationId: string, id: string, supplierInvoiceId: string | null) {
    return prisma.importShipment.update({
      where: { id },
      data: {
        organizationId,
        supplierInvoiceId: supplierInvoiceId ?? null,
      },
      include: shipmentInclude,
    });
  }

  async setLandedCost(organizationId: string, id: string, landedCostId: string | null) {
    return prisma.importShipment.update({
      where: { id },
      data: {
        organizationId,
        landedCostId: landedCostId ?? null,
      },
      include: shipmentInclude,
    });
  }

  async archive(organizationId: string, id: string) {
    return prisma.importShipment.updateMany({
      where: { id, organizationId },
      data: { archivedAt: new Date() },
    });
  }

  async findPurchaseOrderSummary(organizationId: string, purchaseOrderId: string) {
    return prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, organizationId },
      select: { id: true, poNumber: true, status: true, supplierId: true, archivedAt: true },
    });
  }

  async findSupplierInvoiceSummary(organizationId: string, supplierInvoiceId: string) {
    return prisma.supplierInvoice.findFirst({
      where: { id: supplierInvoiceId, organizationId },
      select: { id: true, siNumber: true, status: true, supplierId: true, archivedAt: true },
    });
  }

  async findLandedCostSummary(organizationId: string, landedCostId: string) {
    return prisma.landedCost.findFirst({
      where: { id: landedCostId, organizationId },
      select: { id: true, lcNumber: true, status: true, supplierId: true },
    });
  }
}