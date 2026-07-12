import { prisma } from "@/infrastructure/database/prisma";

import type { CreateSupplierInput, UpdateSupplierInput } from "../validation/supplier-schema";

export class SupplierRepository {
  async listActive(organizationId: string) {
    return prisma.supplier.findMany({
      where: {
        organizationId,
        archivedAt: null,
      },
      orderBy: { name: "asc" },
    });
  }

  async listAll(organizationId: string) {
    return prisma.supplier.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
  }

  async findById(organizationId: string, id: string) {
    return prisma.supplier.findFirst({
      where: { id, organizationId },
    });
  }

  async create(organizationId: string, input: CreateSupplierInput) {
    return prisma.supplier.create({
      data: {
        organizationId,
        name: input.name,
        code: input.code ?? null,
        contactName: input.contactName ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
        paymentTerms: input.paymentTerms ?? null,
        leadTimeDays: input.leadTimeDays ?? null,
        notes: input.notes ?? null,
      },
    });
  }

  async update(organizationId: string, input: UpdateSupplierInput) {
    await prisma.supplier.updateMany({
      where: { id: input.id, organizationId },
      data: {
        name: input.name,
        code: input.code ?? null,
        contactName: input.contactName ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
        paymentTerms: input.paymentTerms ?? null,
        leadTimeDays: input.leadTimeDays ?? null,
        notes: input.notes ?? null,
      },
    });

    return this.findById(organizationId, input.id);
  }

  async archive(organizationId: string, id: string) {
    return prisma.supplier.updateMany({
      where: { id, organizationId },
      data: { archivedAt: new Date() },
    });
  }

  async activate(organizationId: string, id: string) {
    return prisma.supplier.updateMany({
      where: { id, organizationId },
      data: { archivedAt: null },
    });
  }

  async countBlockingReferences(organizationId: string, id: string) {
    const productCount = await prisma.product.count({
      where: { organizationId, supplierId: id, archivedAt: null },
    });
    const purchaseOrderCount = await prisma.purchaseOrder.count({
      where: { organizationId, supplierId: id },
    });

    return {
      total: productCount + purchaseOrderCount,
      details: { products: productCount, purchaseOrders: purchaseOrderCount },
    };
  }

  async delete(organizationId: string, id: string) {
    return prisma.supplier.deleteMany({
      where: { id, organizationId },
    });
  }
}
