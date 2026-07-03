import { prisma } from "@/infrastructure/database/prisma";

import type { CreateSupplierInput } from "../validation/supplier-schema";

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
}
