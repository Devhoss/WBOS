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

/**
 * Pick the user who should own the bootstrap organization.
 *
 * Deterministic by design. "Earliest-created user" is NOT good enough on a
 * production host: whoever happens to sign up first wins, and if that is not
 * the intended owner the real owner ends up with no membership and gets 401
 * from every org-scoped endpoint.
 *
 * Resolution order:
 *   1. WBOS_BOOTSTRAP_OWNER_EMAIL — explicit, the production path.
 *   2. The only user, when exactly one exists — unambiguous, the dev path.
 *   3. Otherwise: refuse to guess and say so.
 */
async function resolveBootstrapOwner(client) {
  const configured = (process.env.WBOS_BOOTSTRAP_OWNER_EMAIL ?? "").trim();

  if (configured) {
    const user = await client.user.findFirst({
      where: { email: { equals: configured, mode: "insensitive" } },
    });
    if (user) return { user, reason: `WBOS_BOOTSTRAP_OWNER_EMAIL=${configured}` };
    return {
      user: null,
      reason: `no user with email ${configured} yet — have them sign up, then re-run this seed`,
    };
  }

  const users = await client.user.findMany({ orderBy: { createdAt: "asc" }, take: 2 });
  if (users.length === 0) {
    return { user: null, reason: "no users exist yet — sign up, then re-run this seed" };
  }
  if (users.length === 1) {
    return { user: users[0], reason: "the only existing user" };
  }
  return {
    user: null,
    reason:
      "multiple users exist and WBOS_BOOTSTRAP_OWNER_EMAIL is not set — " +
      "set it to the intended owner's email and re-run this seed",
  };
}

/**
 * Ensure the designated owner actually holds an OWNER membership.
 *
 * Runs on EVERY seed invocation, including when the organization already
 * exists. The previous version returned early in that case, so an owner who
 * signed up after the first seed could never be attached by re-running it.
 */
async function ensureOwnerMembership(client, organizationId) {
  const { user, reason } = await resolveBootstrapOwner(client);

  if (!user) {
    console.log(`Owner not attached: ${reason}.`);
    return null;
  }

  const existing = await client.organizationMembership.findFirst({
    where: { userId: user.id },
  });

  if (existing) {
    console.log(
      `Owner already attached: ${user.email} holds ${existing.role} membership (${reason}).`,
    );
    return user;
  }

  await client.organizationMembership.create({
    data: { organizationId, userId: user.id, role: "OWNER" },
  });
  console.log(`Attached ${user.email} as OWNER (${reason}).`);
  return user;
}

async function main() {
  const orgName = process.env.WBOS_SEED_ORGANIZATION_NAME || "My Organization";

  const existingOrg = await prisma.organization.findUnique({ where: { id: BOOTSTRAP_ORG_ID } });
  if (existingOrg) {
    // Reference data is already in place, but still reconcile ownership so
    // re-running the seed is a valid way to fix a missing OWNER membership.
    console.log(`Bootstrap organization "${existingOrg.name}" already exists — checking ownership.`);
    await ensureOwnerMembership(prisma, existingOrg.id);
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

    const owner = await ensureOwnerMembership(tx, org.id);

    await tx.activityLog.create({
      data: {
        organizationId: org.id,
        userId: owner?.id ?? null,
        action: "DEVELOPMENT_SEED",
        entityType: "Organization",
        entityId: org.id,
        summary: `Bootstrap organization created.${
          owner
            ? ` Attached user ${owner.email} as OWNER.`
            : " No owner attached yet — the first user to complete onboarding claims it."
        }`,
      },
    });
  });

  console.log(`Bootstrap organization "${orgName}" created (${BOOTSTRAP_ORG_ID}).`);
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    console.log(
      "No users found. The first user to complete onboarding becomes OWNER of this organization.\n" +
        "Set WBOS_BOOTSTRAP_OWNER_EMAIL and re-run this seed to attach a specific account instead.",
    );
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
