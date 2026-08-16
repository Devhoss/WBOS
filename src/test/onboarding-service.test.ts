import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OnboardingService } from "@/domains/organization/services/onboarding-service";
import { prisma } from "@/infrastructure/database/prisma";
import { BusinessError } from "@/shared/errors/business-error";

// The global setup mock (src/test/setup.ts) does not cover the organization
// models, so this file supplies its own.
vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    organization: { findFirst: vi.fn(), create: vi.fn() },
    organizationMembership: { findFirst: vi.fn(), create: vi.fn(), count: vi.fn() },
    businessSettings: { create: vi.fn() },
    activityLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const db = prisma as unknown as {
  organization: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  organizationMembership: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  businessSettings: { create: ReturnType<typeof vi.fn> };
  activityLog: { create: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

const BOOTSTRAP_ORG = { id: "bootstrap-org-001", name: "My Organization" };

describe("OnboardingService.completeFirstOrganization — first-owner bootstrap", () => {
  const originalEnv = { ...process.env };
  let service: OnboardingService;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.WBOS_BOOTSTRAP_OWNER_EMAIL;
    service = new OnboardingService();
    // Default: user has no membership anywhere.
    db.organizationMembership.findFirst.mockResolvedValue(null);
    db.organizationMembership.create.mockResolvedValue({});
    db.activityLog.create.mockResolvedValue({});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("Day-0: attaches the first user as OWNER of an unclaimed seeded organization", async () => {
    // This is the production Day-0 path: prisma/seed.mjs created the bootstrap
    // organization before anyone signed up, so it has zero members.
    db.organization.findFirst.mockResolvedValue(BOOTSTRAP_ORG);
    db.organizationMembership.count.mockResolvedValue(0);

    const org = await service.completeFirstOrganization({
      userId: "user-1",
      userEmail: "owner@example.com",
      organizationName: "Ignored — organization already exists",
    });

    expect(org).toEqual(BOOTSTRAP_ORG);
    expect(db.organizationMembership.create).toHaveBeenCalledWith({
      data: { organizationId: BOOTSTRAP_ORG.id, userId: "user-1", role: "OWNER" },
    });
  });

  it("refuses to auto-attach a later signup once the organization has an owner", async () => {
    // Regression guard: without this, anyone who can reach the public sign-up
    // page becomes an OWNER of the business — ledgers, backups, restore.
    db.organization.findFirst.mockResolvedValue(BOOTSTRAP_ORG);
    db.organizationMembership.count.mockResolvedValue(1);

    await expect(
      service.completeFirstOrganization({
        userId: "stranger-1",
        userEmail: "stranger@example.com",
        organizationName: "Attempted takeover",
      }),
    ).rejects.toBeInstanceOf(BusinessError);

    expect(db.organizationMembership.create).not.toHaveBeenCalled();
  });

  it("reports a clear, non-technical reason when joining is refused", async () => {
    db.organization.findFirst.mockResolvedValue(BOOTSTRAP_ORG);
    db.organizationMembership.count.mockResolvedValue(1);

    await expect(
      service.completeFirstOrganization({
        userId: "stranger-1",
        userEmail: "stranger@example.com",
        organizationName: "x",
      }),
    ).rejects.toMatchObject({ code: "ORGANIZATION_JOIN_NOT_PERMITTED" });
  });

  it("lets the operator-designated owner claim an organization that already has members", async () => {
    // Recovery path: the wrong account claimed OWNER first, or the intended
    // owner signed up late. The operator names them explicitly.
    process.env.WBOS_BOOTSTRAP_OWNER_EMAIL = "Owner@Example.com";
    db.organization.findFirst.mockResolvedValue(BOOTSTRAP_ORG);
    db.organizationMembership.count.mockResolvedValue(1);

    const org = await service.completeFirstOrganization({
      userId: "user-9",
      userEmail: "owner@example.com", // case-insensitive match
      organizationName: "x",
    });

    expect(org).toEqual(BOOTSTRAP_ORG);
    expect(db.organizationMembership.create).toHaveBeenCalledWith({
      data: { organizationId: BOOTSTRAP_ORG.id, userId: "user-9", role: "OWNER" },
    });
  });

  it("still refuses a non-designated user when WBOS_BOOTSTRAP_OWNER_EMAIL is set", async () => {
    process.env.WBOS_BOOTSTRAP_OWNER_EMAIL = "owner@example.com";
    db.organization.findFirst.mockResolvedValue(BOOTSTRAP_ORG);
    db.organizationMembership.count.mockResolvedValue(1);

    await expect(
      service.completeFirstOrganization({
        userId: "stranger-1",
        userEmail: "stranger@example.com",
        organizationName: "x",
      }),
    ).rejects.toBeInstanceOf(BusinessError);
  });

  it("does not treat a missing email as a match for an unset designation", async () => {
    // Guards against "" === "" collapsing into an accidental match.
    db.organization.findFirst.mockResolvedValue(BOOTSTRAP_ORG);
    db.organizationMembership.count.mockResolvedValue(1);

    await expect(
      service.completeFirstOrganization({
        userId: "stranger-1",
        userEmail: null,
        organizationName: "x",
      }),
    ).rejects.toBeInstanceOf(BusinessError);
  });

  it("is idempotent: an existing member gets their organization back, not a second membership", async () => {
    db.organizationMembership.findFirst.mockResolvedValue({
      id: "m-1",
      organization: BOOTSTRAP_ORG,
    });

    const org = await service.completeFirstOrganization({
      userId: "user-1",
      userEmail: "owner@example.com",
      organizationName: "x",
    });

    expect(org).toEqual(BOOTSTRAP_ORG);
    expect(db.organizationMembership.create).not.toHaveBeenCalled();
    expect(db.organization.findFirst).not.toHaveBeenCalled();
  });

  it("creates the organization and an OWNER membership when none exists at all", async () => {
    db.organization.findFirst.mockResolvedValue(null);
    const tx = {
      organization: { create: vi.fn().mockResolvedValue({ id: "org-new", name: "Acme" }) },
      organizationMembership: { create: vi.fn().mockResolvedValue({}) },
      businessSettings: { create: vi.fn().mockResolvedValue({}) },
      activityLog: { create: vi.fn().mockResolvedValue({}) },
    };
    db.$transaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(tx));

    const org = await service.completeFirstOrganization({
      userId: "user-1",
      userEmail: "owner@example.com",
      organizationName: "Acme",
    });

    expect(org).toEqual({ id: "org-new", name: "Acme" });
    expect(tx.organizationMembership.create).toHaveBeenCalledWith({
      data: { organizationId: "org-new", userId: "user-1", role: "OWNER" },
    });
  });
});
