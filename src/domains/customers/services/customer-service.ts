import { Prisma } from "@prisma/client";

import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { CustomerRepository } from "../repositories/customer-repository";
import type { CreateCustomerInput, UpdateCustomerInput } from "../validation/customer-schema";

export class CustomerService {
  constructor(
    private readonly customers = new CustomerRepository(),
    private readonly activityLogs = new ActivityLogRepository(),
  ) {}

  async listActive(context: AuthenticatedRequestContext) {
    return this.customers.listActive(context.organizationId);
  }

  async listAll(context: AuthenticatedRequestContext) {
    return this.customers.listAll(context.organizationId);
  }

  async create(context: AuthenticatedRequestContext, input: CreateCustomerInput) {
    try {
      const customer = await this.customers.create(context.organizationId, input);

      await this.activityLogs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "CUSTOMER_CREATED",
        entityType: "Customer",
        entityId: customer.id,
        summary: `Customer ${customer.name} was created.`,
        metadata: {
          code: customer.code,
          email: customer.email,
          paymentTerms: customer.paymentTerms,
          creditLimit: customer.creditLimit?.toString() ?? null,
        },
      });

      return customer;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BusinessError("A customer with this name or code already exists.", "CUSTOMER_EXISTS");
      }

      throw error;
    }
  }

  async update(context: AuthenticatedRequestContext, input: UpdateCustomerInput) {
    const existing = await this.customers.findById(context.organizationId, input.id);

    if (!existing) {
      throw new BusinessError("Customer was not found.", "CUSTOMER_NOT_FOUND");
    }

    try {
      const customer = await this.customers.update(context.organizationId, input);

      await this.activityLogs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "CUSTOMER_UPDATED",
        entityType: "Customer",
        entityId: customer!.id,
        summary: `Customer ${customer!.name} was updated.`,
        metadata: {
          code: customer!.code,
          email: customer!.email,
          paymentTerms: customer!.paymentTerms,
          creditLimit: customer!.creditLimit?.toString() ?? null,
        },
      });

      return customer;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BusinessError("A customer with this name or code already exists.", "CUSTOMER_EXISTS");
      }

      throw error;
    }
  }

  async archive(context: AuthenticatedRequestContext, id: string) {
    const customer = await this.requireCustomer(context, id);

    await this.customers.archive(context.organizationId, id);
    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "CUSTOMER_ARCHIVED",
      entityType: "Customer",
      entityId: id,
      summary: `Customer ${customer.name} was archived.`,
      metadata: { code: customer.code },
    });
  }

  async activate(context: AuthenticatedRequestContext, id: string) {
    const customer = await this.requireCustomer(context, id);

    await this.customers.activate(context.organizationId, id);
    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "CUSTOMER_ACTIVATED",
      entityType: "Customer",
      entityId: id,
      summary: `Customer ${customer.name} was activated.`,
      metadata: { code: customer.code },
    });
  }

  async delete(context: AuthenticatedRequestContext, id: string) {
    const customer = await this.requireCustomer(context, id);
    const references = await this.customers.countBlockingReferences(context.organizationId, id);

    if (references.total > 0) {
      throw new BusinessError(
        "Customer cannot be deleted because it has related orders, invoices, or payments.",
        "CUSTOMER_IN_USE",
      );
    }

    await this.customers.delete(context.organizationId, id);
    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "CUSTOMER_DELETED",
      entityType: "Customer",
      entityId: id,
      summary: `Customer ${customer.name} was deleted.`,
      metadata: { code: customer.code },
    });
  }

  private async requireCustomer(context: AuthenticatedRequestContext, id: string) {
    const customer = await this.customers.findById(context.organizationId, id);

    if (!customer) {
      throw new BusinessError("Customer was not found.", "CUSTOMER_NOT_FOUND");
    }

    return customer;
  }
}
