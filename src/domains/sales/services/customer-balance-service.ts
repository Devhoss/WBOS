import { prisma } from "@/infrastructure/database/prisma";

export class CustomerBalanceService {
  async getOutstanding(organizationId: string, customerId: string) {
    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId,
        customerId,
        status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
      },
      select: { totalAmount: true, amountPaid: true },
    });

    return invoices.reduce(
      (total, inv) => total + (Number(inv.totalAmount) - Number(inv.amountPaid)),
      0,
    );
  }

  async getBalanceSummary(organizationId: string, customerId: string) {
    const [allInvoices, openInvoices] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          organizationId,
          customerId,
          status: { notIn: ["DRAFT", "CANCELLED"] },
        },
        select: { totalAmount: true, amountPaid: true },
      }),
      prisma.invoice.findMany({
        where: {
          organizationId,
          customerId,
          status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
        },
        select: { totalAmount: true, amountPaid: true },
      }),
    ]);

    const totalInvoiced = allInvoices.reduce((s, i) => s + Number(i.totalAmount), 0);
    const totalPaid = allInvoices.reduce((s, i) => s + Number(i.amountPaid), 0);
    const outstanding = openInvoices.reduce(
      (s, i) => s + (Number(i.totalAmount) - Number(i.amountPaid)),
      0,
    );

    return {
      totalInvoiced,
      totalPaid,
      outstanding,
      openInvoiceCount: openInvoices.length,
    };
  }
}
