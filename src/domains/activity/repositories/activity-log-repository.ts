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
}
