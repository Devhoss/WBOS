import { Prisma, type CurrencyCode, type PaymentMethod } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";

type CreatePaymentInput = {
  invoiceId: string;
  customerId: string;
  amount: number;
  currency: CurrencyCode;
  method: PaymentMethod;
  reference: string | null | undefined;
  paidAt: Date;
  notes: string | null | undefined;
};

export class PaymentRepository {
  async create(
    organizationId: string,
    paymentNumber: string,
    input: CreatePaymentInput,
  ) {
    return prisma.payment.create({
      data: {
        organizationId,
        paymentNumber,
        invoiceId: input.invoiceId,
        customerId: input.customerId,
        amount: new Prisma.Decimal(input.amount),
        currency: input.currency,
        method: input.method,
        reference: input.reference,
        paidAt: input.paidAt ?? new Date(),
        notes: input.notes,
      },
    });
  }

  async findById(organizationId: string, id: string) {
    return prisma.payment.findFirst({
      where: { id, organizationId },
      include: {
        invoice: { select: { id: true, invoiceNumber: true } },
        customer: { select: { id: true, name: true } },
      },
    });
  }

  async listByInvoice(organizationId: string, invoiceId: string) {
    return prisma.payment.findMany({
      where: { organizationId, invoiceId },
      orderBy: { paidAt: "desc" },
    });
  }

  async listWithFilters(
    organizationId: string,
    filters: {
      invoiceId?: string;
      customerId?: string;
      method?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const where: Prisma.PaymentWhereInput = { organizationId };

    if (filters.invoiceId) where.invoiceId = filters.invoiceId;
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.method) where.method = filters.method as never;

    const [data, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          invoice: { select: { id: true, invoiceNumber: true } },
          customer: { select: { id: true, name: true } },
        },
        orderBy: { paidAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.payment.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }
}
