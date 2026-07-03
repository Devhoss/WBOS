import { Prisma } from "@prisma/client";

import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { CustomerRepository } from "../repositories/customer-repository";
import type { CreateCustomerInput } from "../validation/customer-schema";

export class CustomerService {
  constructor(
    private readonly customers = new CustomerRepository(),
    private readonly activityLogs = new ActivityLogRepository(),
  ) {}

  async listActive(context: AuthenticatedRequestContext) {
    return this.customers.listActive(context.organizationId);
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
}
