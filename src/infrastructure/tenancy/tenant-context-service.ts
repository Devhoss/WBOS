import { BusinessError } from "@/shared/errors/business-error";

import { OrganizationRepository } from "@/domains/organization/repositories/organization-repository";

export class TenantContextService {
  constructor(private readonly organizations = new OrganizationRepository()) {}

  async getRequiredTenantForUser(userId: string) {
    const membership = await this.organizations.findFirstForUser(userId);

    if (!membership) {
      throw new BusinessError("Your account is not connected to an organization.", "ORGANIZATION_REQUIRED");
    }

    return {
      organization: membership.organization,
      membership,
      organizationId: membership.organizationId,
      role: membership.role,
    };
  }
}
