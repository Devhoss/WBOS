import { type DocumentType } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";

const defaultDocumentSequences: Array<{ documentType: DocumentType; prefix: string }> = [
  { documentType: "INV", prefix: "INV" },
  { documentType: "PO", prefix: "PO" },
  { documentType: "CN", prefix: "CN" },
  { documentType: "PAY", prefix: "PAY" },
  { documentType: "GRN", prefix: "GRN" },
];

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

    const year = new Date().getFullYear();

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

      await tx.documentSequence.createMany({
        data: defaultDocumentSequences.map((sequence) => ({
          organizationId: organization.id,
          documentType: sequence.documentType,
          year,
          currentSequence: 0,
          prefix: sequence.prefix,
          separator: "-",
          digits: 6,
        })),
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
