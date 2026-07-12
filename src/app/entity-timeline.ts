import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";

export type TimelineEntry = {
  action: string;
  summary: string;
  createdAt: Date;
};

export async function getEntityTimeline(
  organizationId: string,
  entityType: string,
  entityId: string,
): Promise<TimelineEntry[]> {
  const logs = await new ActivityLogRepository().listForEntity(organizationId, entityType, entityId);

  return logs.map((log) => ({
    action: log.action,
    summary: log.summary,
    createdAt: log.createdAt,
  }));
}
