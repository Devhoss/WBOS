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

  async markAsRead(id: string) {
    return prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(organizationId: string, userId: string) {
    return prisma.notification.updateMany({
      where: { organizationId, userId, isRead: false },
      data: { isRead: true },
    });
  }
}
