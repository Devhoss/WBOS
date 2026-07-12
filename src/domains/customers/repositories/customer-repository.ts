import { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";

import type { CreateCustomerInput, UpdateCustomerInput } from "../validation/customer-schema";

export class CustomerRepository {
  async listActive(organizationId: string) {
    return prisma.customer.findMany({
      where: { organizationId, archivedAt: null },
      orderBy: { name: "asc" },
    });
  }

  async listAll(organizationId: string) {
    return prisma.customer.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
  }

  async findById(organizationId: string, id: string) {
    return prisma.customer.findFirst({
      where: { id, organizationId },
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
        creditLimit: input.creditLimit === undefined ? null : new Prisma.Decimal(input.creditLimit),
        notes: input.notes ?? null,
      },
    });
  }

  async update(organizationId: string, input: UpdateCustomerInput) {
    await prisma.customer.updateMany({
      where: { id: input.id, organizationId },
      data: {
        name: input.name,
        code: input.code ?? null,
        contactName: input.contactName ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
        paymentTerms: input.paymentTerms ?? null,
        creditLimit: input.creditLimit === undefined ? null : new Prisma.Decimal(input.creditLimit),
        notes: input.notes ?? null,
      },
    });

    return this.findById(organizationId, input.id);
  }

  async archive(organizationId: string, id: string) {
    return prisma.customer.updateMany({
      where: { id, organizationId },
      data: { archivedAt: new Date() },
    });
  }

  async activate(organizationId: string, id: string) {
    return prisma.customer.updateMany({
      where: { id, organizationId },
      data: { archivedAt: null },
    });
  }

  async countBlockingReferences(organizationId: string, id: string) {
    const [salesOrders, invoices, payments] = await Promise.all([
      prisma.salesOrder.count({ where: { organizationId, customerId: id } }),
      prisma.invoice.count({ where: { organizationId, customerId: id } }),
      prisma.payment.count({ where: { organizationId, customerId: id } }),
    ]);

    return {
      total: salesOrders + invoices + payments,
      details: { salesOrders, invoices, payments },
    };
  }

  async delete(organizationId: string, id: string) {
    return prisma.customer.deleteMany({
      where: { id, organizationId },
    });
  }
}
