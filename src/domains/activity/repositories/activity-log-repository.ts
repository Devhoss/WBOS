import type { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";

export type CreateActivityLogInput = {
  organizationId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  summary: string;
  metadata?: Prisma.InputJsonValue;
};

export class ActivityLogRepository {
  async create(input: CreateActivityLogInput) {
    return prisma.activityLog.create({
      data: input,
    });
  }

  async listRecent(organizationId: string, limit = 10) {
    return prisma.activityLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async listForEntity(organizationId: string, entityType: string, entityId: string) {
    return prisma.activityLog.findMany({
      where: { organizationId, entityType, entityId },
      orderBy: { createdAt: "asc" },
    });
  }

  async listPaginated(params: {
    organizationId: string;
    page: number;
    pageSize: number;
    search?: string;
    action?: string;
    entityType?: string;
    userId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }) {
    const { organizationId, page, pageSize, search, action, entityType, userId, dateFrom, dateTo } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ActivityLogWhereInput = { organizationId };

    if (search) {
      where.OR = [
        { summary: { contains: search, mode: "insensitive" } },
        { action: { contains: search, mode: "insensitive" } },
        { entityType: { contains: search, mode: "insensitive" } },
      ];
    }
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (userId) where.userId = userId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    const [items, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.activityLog.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }
}
