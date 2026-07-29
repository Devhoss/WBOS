import { NotificationRepository, type CreateNotificationInput } from "../repositories/notification-repository";
import type { PushNotificationProvider, PushPayload } from "@/infrastructure/notifications";

type EventContext = {
  organizationId: string;
  userId: string;
};

function toPayload(type: string, link: string | null | undefined): PushPayload {
  switch (type) {
    case "TASK_ASSIGNED":
    case "TASK_COMPLETED":
      return { type, entityType: "task", entityId: link ?? "" };
    case "SHIPMENT_READY":
    case "DELIVERY_COMPLETED":
      return { type, entityType: "shipment", entityId: link ?? "" };
    default:
      return { type, entityType: "unknown", entityId: link ?? "" };
  }
}

export class NotificationService {
  constructor(
    private readonly repo = new NotificationRepository(),
    private readonly pushProvider?: PushNotificationProvider,
  ) {}

  async create(input: CreateNotificationInput) {
    const notification = await this.repo.create(input);

    if (this.pushProvider) {
      this.pushProvider
        .send(input.userId, input.title, input.body, toPayload(input.type, input.link))
        .catch(() => {
          /* FCM failure is non-critical */
        });
    }

    return notification;
  }

  async listByUser(organizationId: string, userId: string, limit?: number) {
    return this.repo.listByUser(organizationId, userId, limit);
  }

  async countUnread(organizationId: string, userId: string) {
    return this.repo.countUnread(organizationId, userId);
  }

  async markAsRead(id: string) {
    return this.repo.markAsRead(id);
  }

  async markAllAsRead(organizationId: string, userId: string) {
    return this.repo.markAllAsRead(organizationId, userId);
  }

  async notifyTaskAssigned(ctx: EventContext, taskNumber: string, link?: string | null) {
    await this.create({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      title: "New Pick Task",
      body: `Task ${taskNumber} has been assigned to you.`,
      type: "TASK_ASSIGNED",
      link: link ?? undefined,
    });
  }

  async notifyShipmentReady(ctx: EventContext, shipmentNumber: string, link?: string | null) {
    await this.create({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      title: "Shipment Ready",
      body: `Shipment ${shipmentNumber} is loaded and ready for delivery.`,
      type: "SHIPMENT_READY",
      link: link ?? undefined,
    });
  }

  async notifyDeliveryCompleted(ctx: EventContext, shipmentNumber: string, link?: string | null) {
    await this.create({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      title: "Delivery Completed",
      body: `Shipment ${shipmentNumber} has been delivered.`,
      type: "DELIVERY_COMPLETED",
      link: link ?? undefined,
    });
  }

  async notifyTaskCompleted(ctx: EventContext, taskNumber: string, link?: string | null) {
    await this.create({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      title: "Task Completed",
      body: `Task ${taskNumber} has been completed.`,
      type: "TASK_COMPLETED",
      link: link ?? undefined,
    });
  }
}
