import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationRepository } from "@/domains/notifications/repositories/notification-repository";
import { prisma } from "@/infrastructure/database/prisma";

/**
 * REGRESSION — audit finding M1.
 *
 * `POST /api/v1/notifications/[id]/read` had no authenticated context at all,
 * and the repository behind it ran `notification.update({ where: { id } })`.
 * A bare primary key is not an authorization decision: any caller who could
 * guess or observe an id could mark another user's — or another
 * organization's — notification as read.
 *
 * Its sibling `DELETE /api/v1/notifications/[id]` was already scoped correctly.
 * That asymmetry (two paths over the same rows, only one protected) is the
 * pattern this suite exists to catch.
 */

const db = prisma as unknown as {
  notification: { updateMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
};

describe("NotificationRepository.markAsRead — authorization scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.notification.updateMany.mockResolvedValue({ count: 1 });
  });

  it("scopes the write to the owning user and organization", async () => {
    await new NotificationRepository().markAsRead("org-1", "user-1", "notif-1");

    expect(db.notification.updateMany).toHaveBeenCalledWith({
      where: { id: "notif-1", organizationId: "org-1", userId: "user-1" },
      data: { isRead: true },
    });
  });

  it("never uses an unscoped update({ where: { id } })", async () => {
    await new NotificationRepository().markAsRead("org-1", "user-1", "notif-1");

    // The vulnerable call shape must not reappear, whatever else changes.
    expect(db.notification.update).not.toHaveBeenCalled();
  });

  it("reports zero rows when the notification belongs to someone else", async () => {
    db.notification.updateMany.mockResolvedValue({ count: 0 });

    const affected = await new NotificationRepository().markAsRead(
      "attacker-org",
      "attacker-user",
      "victim-notification",
    );

    // The route turns 0 into a 404, so "not yours" is indistinguishable from
    // "does not exist" and the endpoint cannot be used to probe for valid ids.
    expect(affected).toBe(0);
  });

  it("returns the affected-row count rather than the row itself", async () => {
    db.notification.updateMany.mockResolvedValue({ count: 1 });

    const affected = await new NotificationRepository().markAsRead("org-1", "user-1", "notif-1");

    expect(affected).toBe(1);
  });
});
