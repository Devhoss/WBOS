import { Prisma, type PaymentMethod, type SupplierInvoiceStatus } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";

import type { CreateSupplierInvoiceInput, UpdateSupplierInvoiceInput } from "../validation/supplier-invoice-schema";

export class SupplierInvoiceRepository {
  async create(
    organizationId: string,
    siNumber: string,
    createdById: string,
    input: CreateSupplierInvoiceInput,
  ) {
    return prisma.supplierInvoice.create({
      data: {
        organizationId,
        siNumber,
        supplierId: input.supplierId,
        currency: input.currency,
        subtotal: new Prisma.Decimal(input.subtotal),
        taxAmount: new Prisma.Decimal(input.taxAmount),
        totalAmount: new Prisma.Decimal(input.totalAmount),
        reference: input.reference,
        dueDate: input.dueDate,
        notes: input.notes,
        createdById,
      },
      include: {
        supplier: true,
        createdBy: { select: { id: true, name: true, email: true } },
        payments: true,
      },
    });
  }

  async findById(organizationId: string, id: string) {
    return prisma.supplierInvoice.findFirst({
      where: { id, organizationId },
      include: {
        supplier: true,
        createdBy: { select: { id: true, name: true, email: true } },
        payments: { orderBy: { paidAt: "desc" } },
      },
    });
  }

  async update(organizationId: string, id: string, input: UpdateSupplierInvoiceInput) {
    return prisma.supplierInvoice.update({
      where: { id },
      data: {
        supplierId: input.supplierId,
        currency: input.currency,
        subtotal: new Prisma.Decimal(input.subtotal),
        taxAmount: new Prisma.Decimal(input.taxAmount),
        totalAmount: new Prisma.Decimal(input.totalAmount),
        reference: input.reference,
        dueDate: input.dueDate,
        notes: input.notes,
      },
      include: {
        supplier: true,
        createdBy: { select: { id: true, name: true, email: true } },
        payments: true,
      },
    });
  }

  async listWithFilters(organizationId: string, filters: {
    status?: SupplierInvoiceStatus;
    supplierId?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  } = {}) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 50;

    const where: Prisma.SupplierInvoiceWhereInput = { organizationId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.supplierId) {
      where.supplierId = filters.supplierId;
    }

    if (filters.search) {
      where.OR = [
        { siNumber: { contains: filters.search, mode: "insensitive" } },
        { reference: { contains: filters.search, mode: "insensitive" } },
        { supplier: { name: { contains: filters.search, mode: "insensitive" } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.supplierInvoice.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.supplierInvoice.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async updateStatus(organizationId: string, id: string, status: SupplierInvoiceStatus) {
    return prisma.supplierInvoice.updateMany({
      where: { id, organizationId },
      data: { status },
    });
  }

  async markIssued(organizationId: string, id: string, issuedAt: Date) {
    return prisma.supplierInvoice.updateMany({
      where: { id, organizationId },
      data: { status: "ISSUED", issuedAt },
    });
  }

  async markPaid(organizationId: string, id: string, paidAt: Date) {
    return prisma.supplierInvoice.updateMany({
      where: { id, organizationId },
      data: { status: "PAID", paidAt },
    });
  }

  async updateAmountPaid(organizationId: string, id: string, amountPaid: Prisma.Decimal.Value) {
    return prisma.supplierInvoice.updateMany({
      where: { id, organizationId },
      data: { amountPaid: new Prisma.Decimal(amountPaid) },
    });
  }

  async archive(organizationId: string, id: string) {
    return prisma.supplierInvoice.updateMany({
      where: { id, organizationId },
      data: { archivedAt: new Date() },
    });
  }

  async createPayment(
    organizationId: string,
    paymentNumber: string,
    input: {
      supplierInvoiceId: string;
      amount: number;
      currency: string;
      method: PaymentMethod;
      reference: string | null | undefined;
      paidAt: Date;
      notes: string | null | undefined;
      createdById: string;
    },
  ) {
    return prisma.supplierInvoicePayment.create({
      data: {
        organizationId,
        paymentNumber,
        supplierInvoiceId: input.supplierInvoiceId,
        amount: new Prisma.Decimal(input.amount),
        currency: input.currency as never,
        method: input.method,
        reference: input.reference,
        paidAt: input.paidAt,
        notes: input.notes,
        createdById: input.createdById,
      },
    });
  }
}