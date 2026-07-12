import { prisma } from "@/infrastructure/database/prisma";

type CompleteOnboardingInput = {
  userId: string;
  organizationName: string;
};

export class OnboardingService {
  async completeFirstOrganization(input: CompleteOnboardingInput) {
    const existingMembership = await prisma.organizationMembership.findFirst({
      where: { userId: input.userId },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    });

    if (existingMembership) {
      return existingMembership.organization;
    }

    const existingOrg = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });

    if (existingOrg) {
      await prisma.organizationMembership.create({
        data: {
          organizationId: existingOrg.id,
          userId: input.userId,
          role: "OWNER",
        },
      });

      await prisma.activityLog.create({
        data: {
          organizationId: existingOrg.id,
          userId: input.userId,
          action: "ORGANIZATION_ONBOARDED",
          entityType: "Organization",
          entityId: existingOrg.id,
          summary: `User ${input.userId} attached to existing organization as OWNER.`,
        },
      });

      return existingOrg;
    }

    return prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: input.organizationName,
          defaultCurrency: "KWD",
          timezone: "Asia/Kuwait",
        },
      });

      await tx.organizationMembership.create({
        data: {
          organizationId: organization.id,
          userId: input.userId,
          role: "OWNER",
        },
      });

      await tx.businessSettings.create({
        data: {
          organizationId: organization.id,
          businessName: input.organizationName,
          defaultCurrency: "KWD",
          timezone: "Asia/Kuwait",
          invoicePrefix: "INV",
        },
      });

      await tx.activityLog.create({
        data: {
          organizationId: organization.id,
          userId: input.userId,
          action: "ORGANIZATION_ONBOARDED",
          entityType: "Organization",
          entityId: organization.id,
          summary: "Organization created during initial onboarding.",
        },
      });

      return organization;
    });
  }
}
