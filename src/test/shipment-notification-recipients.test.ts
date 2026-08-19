import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";

/**
 * Who gets told when a shipment is loaded or delivered.
 *
 * Both events were created with `userId: context.userId` -- the person who had
 * just performed the action. In the real two-person setup that meant the
 * warehouse user marked a delivery complete and then notified himself, while
 * the office, the only party that needed to know, was told nothing. The events
 * also never fired at all from the REST route the mobile app uses, so the
 * defect was invisible in practice.
 *
 * Recipients are now derived from OWNER/MANAGER membership minus the actor, so
 * a second MANAGER added later is included without a code change.
 */

const created: Array<{ userId: string; type: string; link?: string | null }> = [];

vi.mock("@/domains/notifications/services/create-notification-service", () => ({
  createNotificationService: () => ({
    notifyShipmentReady: async (
      ctx: { userId: string },
      ref: { link?: string | null },
    ) => {
      created.push({ userId: ctx.userId, type: "SHIPMENT_READY", link: ref.link });
    },
    notifyDeliveryCompleted: async (
      ctx: { userId: string },
      ref: { link?: string | null },
    ) => {
      created.push({ userId: ctx.userId, type: "DELIVERY_COMPLETED", link: ref.link });
    },
  }),
}));

const db = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

const ORG = "org-1";
const WAREHOUSE_USER = "user-brother";
const OWNER_USER = "user-owner";
const SECOND_MANAGER = "user-second-manager";

const SHIPMENT = { id: "shp-1", shipmentNumber: "SHP-001" };

/** Membership rows the recipient query would return, minus the actor. */
function membershipsExcluding(actor: string, all: Array<{ userId: string }>) {
  return all.filter((m) => m.userId !== actor);
}

async function notify(event: "LOADED" | "DELIVERED", actor: string, members: string[]) {
  db.organizationMembership.findMany.mockImplementation(
    async (args: { where?: { userId?: { not?: string } } }) => {
      const not = args?.where?.userId?.not;
      return membershipsExcluding(not ?? "", members.map((userId) => ({ userId })));
    },
  );
  db.shipment.findFirst.mockResolvedValue({ salesOrder: { soNumber: "SO-001" } });
  db.task.findFirst.mockResolvedValue({ id: "task-1" });

  const { ShipmentService } = await import("@/domains/sales/services/shipment-service");
  const service = new ShipmentService() as unknown as {
    notifyShipmentTransition: (
      ctx: { organizationId: string; userId: string },
      shipment: { id: string; shipmentNumber: string },
      event: "LOADED" | "DELIVERED",
    ) => Promise<void>;
  };
  await service.notifyShipmentTransition(
    { organizationId: ORG, userId: actor },
    SHIPMENT,
    event,
  );
}

describe("shipment notifications reach the office, not the actor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    created.length = 0;
  });

  describe("DELIVERY_COMPLETED", () => {
    it("does not notify the user who confirmed the delivery", async () => {
      await notify("DELIVERED", WAREHOUSE_USER, [WAREHOUSE_USER, OWNER_USER]);
      expect(created.map((c) => c.userId)).not.toContain(WAREHOUSE_USER);
    });

    it("notifies the owner", async () => {
      await notify("DELIVERED", WAREHOUSE_USER, [WAREHOUSE_USER, OWNER_USER]);
      expect(created).toEqual([
        { userId: OWNER_USER, type: "DELIVERY_COMPLETED", link: "task-1" },
      ]);
    });
  });

  describe("SHIPMENT_READY", () => {
    it("does not notify the user who marked it loaded", async () => {
      await notify("LOADED", WAREHOUSE_USER, [WAREHOUSE_USER, OWNER_USER]);
      expect(created.map((c) => c.userId)).not.toContain(WAREHOUSE_USER);
    });

    it("notifies the owner", async () => {
      await notify("LOADED", WAREHOUSE_USER, [WAREHOUSE_USER, OWNER_USER]);
      expect(created).toEqual([
        { userId: OWNER_USER, type: "SHIPMENT_READY", link: "task-1" },
      ]);
    });
  });

  describe("more than one eligible recipient", () => {
    it("notifies every OWNER/MANAGER except the actor", async () => {
      // The behaviour must stay correct when a second MANAGER is added, without
      // anybody editing this code path.
      await notify("DELIVERED", WAREHOUSE_USER, [WAREHOUSE_USER, OWNER_USER, SECOND_MANAGER]);
      expect(new Set(created.map((c) => c.userId))).toEqual(
        new Set([OWNER_USER, SECOND_MANAGER]),
      );
    });

    it("sends exactly one notification per recipient", async () => {
      await notify("DELIVERED", WAREHOUSE_USER, [WAREHOUSE_USER, OWNER_USER, SECOND_MANAGER]);
      expect(created).toHaveLength(2);
      const perUser = new Map<string, number>();
      for (const c of created) perUser.set(c.userId, (perUser.get(c.userId) ?? 0) + 1);
      for (const [, count] of perUser) expect(count).toBe(1);
    });
  });

  describe("degenerate cases", () => {
    it("sends nothing when the actor is the only member", async () => {
      // A one-person organization has no office to tell. Notifying the actor
      // anyway is what the old behaviour did.
      await notify("DELIVERED", OWNER_USER, [OWNER_USER]);
      expect(created).toEqual([]);
    });

    it("a notification failure never propagates out of the transition", async () => {
      db.organizationMembership.findMany.mockRejectedValue(new Error("db down"));
      db.shipment.findFirst.mockResolvedValue({ salesOrder: { soNumber: "SO-001" } });
      db.task.findFirst.mockResolvedValue({ id: "task-1" });

      const { ShipmentService } = await import("@/domains/sales/services/shipment-service");
      const service = new ShipmentService() as unknown as {
        notifyShipmentTransition: (
          c: { organizationId: string; userId: string },
          s: { id: string; shipmentNumber: string },
          e: "LOADED" | "DELIVERED",
        ) => Promise<void>;
      };

      // A delivery that happened must not be rolled back because a message
      // could not be sent.
      await expect(
        service.notifyShipmentTransition({ organizationId: ORG, userId: OWNER_USER }, SHIPMENT, "DELIVERED"),
      ).resolves.toBeUndefined();
      expect(created).toEqual([]);
    });
  });
});
