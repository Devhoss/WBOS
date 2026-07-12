import { prisma } from "@/infrastructure/database/prisma";
import { BaseReportRepository, type ReportDateRange } from "../repositories/base-report-repository";

type FinancialFilters = {
  dateRange?: ReportDateRange;
  customerId?: string | null;
  search?: string;
};

type CustomerStatementRow = {
  date: string;
  documentType: "INVOICE" | "PAYMENT";
  documentNumber: string;
  description: string | null;
  debit: number;
  credit: number;
  balance: number;
};

type OutstandingBalanceRow = {
  customerId: string;
  customerName: string;
  totalInvoiced: number;
  totalPaid: number;
  outstanding: number;
};

type ArAgingRow = {
  customerId: string;
  customerName: string;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days91plus: number;
  totalOutstanding: number;
};

type InvoiceRegisterRow = {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  status: string;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  issuedAt: string | null;
  dueDate: string | null;
};

type PaymentRegisterRow = {
  paymentId: string;
  paymentNumber: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  method: string;
  reference: string | null;
  paidAt: string;
};

type CashCollectionRow = {
  date: string;
  method: string;
  totalAmount: number;
  paymentCount: number;
};

export class FinancialReportService extends BaseReportRepository {
  async customerStatement(customerId: string, filters: FinancialFilters): Promise<CustomerStatementRow[]> {
    const organizationId = await this.resolveOrganizationId();
    const dateFilter = this.buildDateFilter(filters.dateRange);

    const [invoices, payments] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          organizationId,
          customerId,
          status: { notIn: ["DRAFT", "CANCELLED"] },
          ...(dateFilter.gte || dateFilter.lte ? { issuedAt: { ...dateFilter } } : {}),
        },
        select: {
          invoiceNumber: true,
          totalAmount: true,
          amountPaid: true,
          issuedAt: true,
          createdAt: true,
          notes: true,
        },
        orderBy: { issuedAt: "asc" },
      }),
      prisma.payment.findMany({
        where: {
          organizationId,
          customerId,
          ...(dateFilter.gte || dateFilter.lte ? { paidAt: { ...dateFilter } } : {}),
        },
        select: {
          paymentNumber: true,
          amount: true,
          paidAt: true,
          notes: true,
        },
        orderBy: { paidAt: "asc" },
      }),
    ]);

    const rows: CustomerStatementRow[] = [];
    let runningBalance = 0;

    const events: { date: Date; type: "INVOICE" | "PAYMENT"; docNum: string; desc: string | null; debit: number; credit: number }[] = [];

    for (const inv of invoices) {
      const date = inv.issuedAt ?? inv.createdAt;
      events.push({
        date,
        type: "INVOICE",
        docNum: inv.invoiceNumber,
        desc: inv.notes,
        debit: this.toNumber(inv.totalAmount),
        credit: 0,
      });
    }

    for (const pay of payments) {
      events.push({
        date: pay.paidAt,
        type: "PAYMENT",
        docNum: pay.paymentNumber,
        desc: pay.notes,
        debit: 0,
        credit: this.toNumber(pay.amount),
      });
    }

    events.sort((a, b) => a.date.getTime() - b.date.getTime());

    for (const ev of events) {
      runningBalance += ev.debit - ev.credit;
      rows.push({
        date: ev.date.toISOString(),
        documentType: ev.type,
        documentNumber: ev.docNum,
        description: ev.desc,
        debit: ev.debit,
        credit: ev.credit,
        balance: runningBalance,
      });
    }

    return rows;
  }

  async outstandingBalances(): Promise<OutstandingBalanceRow[]> {
    const organizationId = await this.resolveOrganizationId();

    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId,
        status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
      },
      select: {
        customerId: true,
        totalAmount: true,
        amountPaid: true,
        customer: { select: { name: true } },
      },
    });

    const grouped = new Map<string, { customerName: string; totalInvoiced: number; totalPaid: number }>();
    for (const inv of invoices) {
      const existing = grouped.get(inv.customerId);
      const total = this.toNumber(inv.totalAmount);
      const paid = this.toNumber(inv.amountPaid);
      if (existing) {
        existing.totalInvoiced += total;
        existing.totalPaid += paid;
      } else {
        grouped.set(inv.customerId, {
          customerName: inv.customer.name,
          totalInvoiced: total,
          totalPaid: paid,
        });
      }
    }

    return Array.from(grouped.entries()).map(([customerId, data]) => ({
      customerId,
      customerName: data.customerName,
      totalInvoiced: data.totalInvoiced,
      totalPaid: data.totalPaid,
      outstanding: data.totalInvoiced - data.totalPaid,
    }));
  }

  async arAging(filters: FinancialFilters): Promise<ArAgingRow[]> {
    const organizationId = await this.resolveOrganizationId();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId,
        status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
        ...(filters.customerId && { customerId: filters.customerId }),
      },
      select: {
        customerId: true,
        totalAmount: true,
        amountPaid: true,
        dueDate: true,
        customer: { select: { name: true } },
      },
    });

    const grouped = new Map<string, {
      customerName: string;
      buckets: { current: number; d1to30: number; d31to60: number; d61to90: number; d91plus: number };
    }>();

    for (const inv of invoices) {
      const outstanding = this.toNumber(inv.totalAmount) - this.toNumber(inv.amountPaid);
      if (outstanding <= 0) continue;

      const existing = grouped.get(inv.customerId) ?? {
        customerName: inv.customer.name,
        buckets: { current: 0, d1to30: 0, d31to60: 0, d61to90: 0, d91plus: 0 },
      };

      if (!inv.dueDate || inv.dueDate >= today) {
        existing.buckets.current += outstanding;
      } else {
        const daysOverdue = Math.round((today.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysOverdue <= 30) existing.buckets.d1to30 += outstanding;
        else if (daysOverdue <= 60) existing.buckets.d31to60 += outstanding;
        else if (daysOverdue <= 90) existing.buckets.d61to90 += outstanding;
        else existing.buckets.d91plus += outstanding;
      }

      grouped.set(inv.customerId, existing);
    }

    return Array.from(grouped.entries()).map(([customerId, data]) => ({
      customerId,
      customerName: data.customerName,
      current: data.buckets.current,
      days1to30: data.buckets.d1to30,
      days31to60: data.buckets.d31to60,
      days61to90: data.buckets.d61to90,
      days91plus: data.buckets.d91plus,
      totalOutstanding: data.buckets.current + data.buckets.d1to30 + data.buckets.d31to60 + data.buckets.d61to90 + data.buckets.d91plus,
    }));
  }

  async invoiceRegister(filters: FinancialFilters): Promise<InvoiceRegisterRow[]> {
    const organizationId = await this.resolveOrganizationId();
    const dateFilter = this.buildDateFilter(filters.dateRange);

    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId,
        status: { notIn: ["DRAFT"] },
        ...(dateFilter.gte || dateFilter.lte ? { issuedAt: { ...dateFilter } } : {}),
        ...(filters.customerId && { customerId: filters.customerId }),
      },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        totalAmount: true,
        amountPaid: true,
        issuedAt: true,
        dueDate: true,
        customer: { select: { name: true } },
      },
      orderBy: { issuedAt: "desc" },
    });

    return invoices.map((inv) => ({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.customer.name,
      status: inv.status,
      totalAmount: this.toNumber(inv.totalAmount),
      amountPaid: this.toNumber(inv.amountPaid),
      balanceDue: this.toNumber(inv.totalAmount) - this.toNumber(inv.amountPaid),
      issuedAt: inv.issuedAt?.toISOString() ?? null,
      dueDate: inv.dueDate?.toISOString() ?? null,
    }));
  }

  async paymentRegister(filters: FinancialFilters): Promise<PaymentRegisterRow[]> {
    const organizationId = await this.resolveOrganizationId();
    const dateFilter = this.buildDateFilter(filters.dateRange);

    const payments = await prisma.payment.findMany({
      where: {
        organizationId,
        ...(dateFilter.gte || dateFilter.lte ? { paidAt: { ...dateFilter } } : {}),
        ...(filters.customerId && { customerId: filters.customerId }),
      },
      select: {
        id: true,
        paymentNumber: true,
        amount: true,
        method: true,
        reference: true,
        paidAt: true,
        invoice: { select: { invoiceNumber: true } },
        customer: { select: { name: true } },
      },
      orderBy: { paidAt: "desc" },
    });

    return payments.map((pay) => ({
      paymentId: pay.id,
      paymentNumber: pay.paymentNumber,
      invoiceNumber: pay.invoice.invoiceNumber,
      customerName: pay.customer.name,
      amount: this.toNumber(pay.amount),
      method: pay.method,
      reference: pay.reference,
      paidAt: pay.paidAt.toISOString(),
    }));
  }

  async cashCollection(filters: FinancialFilters): Promise<CashCollectionRow[]> {
    const organizationId = await this.resolveOrganizationId();
    const dateFilter = this.buildDateFilter(filters.dateRange);

    const payments = await prisma.payment.findMany({
      where: {
        organizationId,
        ...(dateFilter.gte || dateFilter.lte ? { paidAt: { ...dateFilter } } : {}),
        ...(filters.customerId && { customerId: filters.customerId }),
      },
      select: {
        amount: true,
        method: true,
        paidAt: true,
      },
      orderBy: { paidAt: "asc" },
    });

    const grouped = new Map<string, { totalAmount: number; paymentCount: number }>();
    for (const pay of payments) {
      const date = pay.paidAt.toISOString().slice(0, 10);
      const key = `${date}:${pay.method}`;
      const existing = grouped.get(key);
      const amt = this.toNumber(pay.amount);
      if (existing) {
        existing.totalAmount += amt;
        existing.paymentCount += 1;
      } else {
        grouped.set(key, { totalAmount: amt, paymentCount: 1 });
      }
    }

    return Array.from(grouped.entries()).map(([key, data]) => {
      const [date, method] = key.split(":");
      return {
        date,
        method,
        totalAmount: data.totalAmount,
        paymentCount: data.paymentCount,
      };
    });
  }
}
