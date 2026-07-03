import { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";

import type { CreateCustomerInput } from "../validation/customer-schema";

export class CustomerRepository {
  async listActive(organizationId: string) {
    return prisma.customer.findMany({
      where: {
        organizationId,
        archivedAt: null,
      },
      orderBy: { name: "asc" },
    });
  }

  async create(organizationId: string, input: CreateCustomerInput) {
    return prisma.customer.create({
      data: {
        organizationId,
        name: input.name,
        code: input.code ?? null,
        contactName: input.contactName ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
        paymentTerms: input.paymentTerms ?? null,
        creditLimit:
          input.creditLimit === undefined ? null : new Prisma.Decimal(input.creditLimit),
        notes: input.notes ?? null,
      },
    });
  }
}
