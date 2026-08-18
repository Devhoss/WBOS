import { prisma } from "@/infrastructure/database/prisma";

export type CreateNotificationInput = {
  organizationId: string;
  userId: string;
  title: string;
  body?: string;
  type: string;
  link?: string;
};

export class NotificationRepository {
  async create(input: CreateNotificationInput) {
    return prisma.notification.create({ data: input });
  }

  async listByUser(organizationId: string, userId: string, limit = 50) {
    return prisma.notification.findMany({
      where: { organizationId, userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async countUnread(organizationId: string, userId: string) {
    return prisma.notification.count({
      where: { organizationId, userId, isRead: false },
    });
  }

  /**
   * Scoped to the owning user, mirroring `deleteById`. `update({ where: { id } })`
   * would happily mark any notification in any organization as read, because a
   * bare id is not an authorization decision. Returns the affected-row count so
   * the caller can distinguish "not yours" from "done" without leaking which.
   */
  async markAsRead(organizationId: string, userId: string, id: string) {
    const result = await prisma.notification.updateMany({
      where: { id, organizationId, userId },
      data: { isRead: true },
    });
    return result.count;
  }

  async markAllAsRead(organizationId: string, userId: string) {
    return prisma.notification.updateMany({
      where: { organizationId, userId, isRead: false },
      data: { isRead: true },
    });
  }

  async deleteRead(organizationId: string, userId: string) {
    return prisma.notification.deleteMany({
      where: { organizationId, userId, isRead: true },
    });
  }

  async deleteById(organizationId: string, userId: string, id: string) {
    const result = await prisma.notification.deleteMany({
      where: { id, organizationId, userId },
    });
    return result.count;
  }

  /**
   * Retention pruning for the "recent activity feed": notifications are deleted
   * once they are older than `maxAgeDays` OR fall outside the newest `maxPerUser`
   * entries for a given user. Whichever limit is reached first.
   */
  async prune(
    organizationId: string,
    userId: string,
    maxPerUser = 50,
    maxAgeDays = 30,
  ) {
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
    await prisma.notification.deleteMany({
      where: { organizationId, userId, createdAt: { lt: cutoff } },
    });

    const latest = await prisma.notification.findMany({
      where: { organizationId, userId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
      take: maxPerUser,
    });
    if (latest.length > 0) {
      await prisma.notification.deleteMany({
        where: { organizationId, userId, id: { notIn: latest.map((n) => n.id) } },
      });
    }
  }
}
