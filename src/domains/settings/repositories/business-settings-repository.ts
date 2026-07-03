import { prisma } from "@/infrastructure/database/prisma";

import type { UpdateBusinessSettingsInput } from "../validation/business-settings-schema";

export class BusinessSettingsRepository {
  async findByOrganizationId(organizationId: string) {
    return prisma.businessSettings.findUnique({
      where: { organizationId },
    });
  }

  async updateForOrganization(organizationId: string, input: UpdateBusinessSettingsInput) {
    return prisma.businessSettings.update({
      where: { organizationId },
      data: input,
    });
  }
}
