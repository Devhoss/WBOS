import { prisma } from "@/infrastructure/database/prisma";
import { BusinessError } from "@/shared/errors/business-error";

type CompleteOnboardingInput = {
  userId: string;
  userEmail?: string | null;
  organizationName: string;
};

/**
 * Email permitted to claim OWNER of an organization that already has members.
 * Set `WBOS_BOOTSTRAP_OWNER_EMAIL` on the production host so Day-0 ownership is
 * a deliberate configuration choice rather than a race to sign up first.
 */
function designatedOwnerEmail(): string | null {
  const raw = process.env.WBOS_BOOTSTRAP_OWNER_EMAIL;
  const trimmed = (raw ?? "").trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

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
      // An organization exists but this user has no membership. Attaching them
      // as OWNER is correct ONLY while the organization is unclaimed (Day-0,
      // e.g. created by prisma/seed.mjs before anyone signed up).
      //
      // Once it has members, auto-attaching would mean anyone who can reach the
      // public sign-up page becomes an OWNER of the business — full access to
      // ledgers, backups and restore. Refuse instead, unless this is the email
      // the operator explicitly designated.
      const memberCount = await prisma.organizationMembership.count({
        where: { organizationId: existingOrg.id },
      });
      const designated = designatedOwnerEmail();
      const email = (input.userEmail ?? "").trim().toLowerCase();
      const isDesignatedOwner = designated !== null && email.length > 0 && email === designated;

      if (memberCount > 0 && !isDesignatedOwner) {
        throw new BusinessError(
          "This workspace already has an owner. Ask an existing owner to grant you access — " +
            "new accounts are not added automatically.",
          "ORGANIZATION_JOIN_NOT_PERMITTED",
        );
      }

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
