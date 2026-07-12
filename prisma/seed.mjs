import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BOOTSTRAP_ORG_ID = "bootstrap-org-001";

const DEFAULT_DOCUMENT_SEQUENCES = [
  { documentType: "INV", prefix: "INV" },
  { documentType: "PO", prefix: "PO" },
  { documentType: "CN", prefix: "CN" },
  { documentType: "PAY", prefix: "PAY" },
  { documentType: "GRN", prefix: "GRN" },
  { documentType: "ADJ", prefix: "ADJ" },
  { documentType: "WT", prefix: "WT" },
  { documentType: "SO", prefix: "SO" },
  { documentType: "SHP", prefix: "SHP" },
];

const DEFAULT_WAREHOUSES = [
  { name: "Main Warehouse", code: "MAIN", isDefault: true, address: "Shuwaikh Industrial Area, Block 1, Kuwait City" },
  { name: "Cold Storage", code: "COLD", isDefault: false, address: "Shuwaikh Industrial Area, Block 3, Kuwait City" },
];

const DEFAULT_UNITS_OF_MEASURE = [
  { name: "Piece", code: "PC", isBaseUnit: true, conversionToBase: 1 },
  { name: "Carton", code: "CTN", isBaseUnit: false, conversionToBase: 12 },
  { name: "Case", code: "CS", isBaseUnit: false, conversionToBase: 6 },
];

const DEFAULT_CATEGORIES = [
  { name: "Beverages", code: "BEV" },
  { name: "Dairy & Chilled", code: "DAIRY" },
  { name: "Snacks & Confectionery", code: "SNACK" },
  { name: "Cooking Essentials", code: "COOK" },
  { name: "Rice & Grains", code: "RICE" },
  { name: "Frozen Foods", code: "FROZEN" },
];

const DEFAULT_ADJUSTMENT_REASONS = [
  { name: "Damaged", code: "DAMAGE", direction: "OUT" },
  { name: "Expired", code: "EXPIRED", direction: "OUT" },
  { name: "Found", code: "FOUND", direction: "IN" },
  { name: "Lost", code: "LOST", direction: "OUT" },
  { name: "Opening Balance", code: "OPENING", direction: null, isSystem: true },
];

async function main() {
  const orgName = process.env.WBOS_SEED_ORGANIZATION_NAME || "My Organization";

  const existingOrg = await prisma.organization.findUnique({ where: { id: BOOTSTRAP_ORG_ID } });
  if (existingOrg) {
    console.log(`Seed skipped: bootstrap organization "${existingOrg.name}" already exists.`);
    return;
  }

  const year = new Date().getFullYear();

  await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        id: BOOTSTRAP_ORG_ID,
        name: orgName,
        legalName: orgName,
        defaultCurrency: "KWD",
        timezone: "Asia/Kuwait",
      },
    });

    await tx.businessSettings.create({
      data: {
        organizationId: org.id,
        businessName: orgName,
        arabicBusinessName: "نظام تجارة الجملة",
        address: "Shuwaikh Industrial Area, Kuwait City",
        phone: "+965 1234 5678",
        email: "info@wbosdemo.com",
        website: "https://wbosdemo.com",
        vatNumber: "300123456",
        commercialRegistration: "123456",
        defaultCurrency: "KWD",
        timezone: "Asia/Kuwait",
        invoicePrefix: "INV",
        approvalMode: "SELF",
        documentLanguage: "bilingual",
        footer: "Thank you for your business!",
        termsAndConditions: "Payment due within 30 days. Goods sold are non-returnable.",
      },
    });

    await tx.documentSequence.createMany({
      data: DEFAULT_DOCUMENT_SEQUENCES.map((seq) => ({
        organizationId: org.id,
        documentType: seq.documentType,
        year,
        currentSequence: 0,
        prefix: seq.prefix,
        separator: "-",
        digits: 6,
      })),
    });

    await tx.warehouse.createMany({
      data: DEFAULT_WAREHOUSES.map((wh, i) => ({
        id: `bootstrap-wh-${String(i + 1).padStart(2, "0")}`,
        organizationId: org.id,
        name: wh.name,
        code: wh.code,
        isDefault: wh.isDefault,
        address: wh.address,
      })),
    });

    await tx.unitOfMeasure.createMany({
      data: DEFAULT_UNITS_OF_MEASURE.map((uom) => ({
        id: `bootstrap-uom-${uom.code.toLowerCase()}`,
        organizationId: org.id,
        name: uom.name,
        code: uom.code,
        isBaseUnit: uom.isBaseUnit,
        conversionToBase: uom.conversionToBase,
      })),
    });

    await tx.category.createMany({
      data: DEFAULT_CATEGORIES.map((cat, i) => ({
        id: `bootstrap-cat-${String(i + 1).padStart(2, "0")}`,
        organizationId: org.id,
        name: cat.name,
        code: cat.code,
      })),
    });

    await tx.adjustmentReason.createMany({
      data: DEFAULT_ADJUSTMENT_REASONS.map((reason) => ({
        id: `bootstrap-adj-${reason.code.toLowerCase()}`,
        organizationId: org.id,
        name: reason.name,
        code: reason.code,
        direction: reason.direction,
        isSystem: reason.isSystem,
      })),
    });

    // Attach any existing Better Auth user as OWNER
    const firstUser = await tx.user.findFirst({ orderBy: { createdAt: "asc" } });
    if (firstUser) {
      const existingMembership = await tx.organizationMembership.findFirst({
        where: { userId: firstUser.id },
      });
      if (!existingMembership) {
        await tx.organizationMembership.create({
          data: {
            organizationId: org.id,
            userId: firstUser.id,
            role: "OWNER",
          },
        });
      }
    }

    await tx.activityLog.create({
      data: {
        organizationId: org.id,
        userId: firstUser?.id ?? null,
        action: "DEVELOPMENT_SEED",
        entityType: "Organization",
        entityId: org.id,
        summary: `Bootstrap organization created.${firstUser ? ` Attached user ${firstUser.email} as OWNER.` : " No users exist yet — first signup will be auto-attached."}`,
      },
    });
  });

  console.log(`Bootstrap organization "${orgName}" created (${BOOTSTRAP_ORG_ID}).`);
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    console.log("No users found. The first user to sign up will automatically become the organization owner.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
