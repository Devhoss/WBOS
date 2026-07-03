import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const defaultDocumentSequences = [
  { documentType: "INV", prefix: "INV" },
  { documentType: "PO", prefix: "PO" },
  { documentType: "CN", prefix: "CN" },
  { documentType: "PAY", prefix: "PAY" },
  { documentType: "GRN", prefix: "GRN" },
];

async function ensureOrganizationForUser(user) {
  const existingMembership = await prisma.organizationMembership.findFirst({
    where: { userId: user.id },
    include: { organization: true },
  });

  if (existingMembership) {
    console.log(`Seed skipped: ${user.email} already belongs to ${existingMembership.organization.name}.`);
    return;
  }

  const organizationName = process.env.WBOS_SEED_ORGANIZATION_NAME || "WBOS Demo Organization";
  const year = new Date().getFullYear();

  await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: organizationName,
        defaultCurrency: "KWD",
        timezone: "Asia/Kuwait",
      },
    });

    await tx.organizationMembership.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        role: "OWNER",
      },
    });

    await tx.businessSettings.create({
      data: {
        organizationId: organization.id,
        businessName: organizationName,
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
        userId: user.id,
        action: "DEVELOPMENT_SEED",
        entityType: "Organization",
        entityId: organization.id,
        summary: "Development seed completed organization setup for an existing Better Auth user.",
      },
    });
  });

  console.log(`Seed created organization "${organizationName}" for ${user.email}.`);
}

async function main() {
  const seedEmail = process.env.WBOS_SEED_USER_EMAIL;
  const user = seedEmail
    ? await prisma.user.findUnique({ where: { email: seedEmail } })
    : await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });

  if (!user) {
    console.log("Seed skipped: create a user through Better Auth first, then rerun npm run db:seed.");
    return;
  }

  await ensureOrganizationForUser(user);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
