import { prisma } from "@/infrastructure/database/prisma";

export class BusinessSettingsRepository {
  async findByOrganizationId(organizationId: string) {
    return prisma.businessSettings.findUnique({ where: { organizationId } });
  }

  async updateForOrganization(organizationId: string, data: Record<string, unknown>) {
    return prisma.businessSettings.update({ where: { organizationId }, data });
  }
}
