import { NotificationRepository, type CreateNotificationInput } from "../repositories/notification-repository";
import type { PushNotificationProvider, PushPayload } from "@/infrastructure/notifications";

type EventContext = {
  organizationId: string;
  userId: string;
};

export type TaskNotificationRef = {
  taskNumber: string;
  soNumber?: string | null;
  link?: string | null;
};

export type TaskScheduledNotificationRef = TaskNotificationRef & {
  dueAt: Date;
  timezone: string;
};

export type ShipmentNotificationRef = {
  shipmentNumber: string;
  soNumber?: string | null;
  link?: string | null;
};

function toPayload(type: string, link: string | null | undefined): PushPayload {
  switch (type) {
    case "TASK_ASSIGNED":
    case "TASK_SCHEDULED":
    case "TASK_COMPLETED":
    case "TASK_AVAILABLE":
      return { type, entityType: "task", entityId: link ?? "" };
    case "SHIPMENT_READY":
    case "DELIVERY_COMPLETED":
      // `link` is the pick TASK for the shipment, not the shipment id. It used
      // to be the shipment id while the client navigated to /picking/<link>,
      // so every one of these opened "Pick Order Not Found".
      return { type, entityType: link ? "task" : "none", entityId: link ?? "" };
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
    await this.repo.prune(input.organizationId, input.userId);

    if (this.pushProvider) {
      this.pushProvider
        .send(input.userId, input.title, input.body, toPayload(input.type, input.link))
        .then((result) => {
          if (!result.success) {
            console.warn(`[push] Send failed (user=${input.userId}): ${result.error ?? "no error detail"}`);
          }
        })
        .catch((err) => {
          console.error(`[push] Provider threw (user=${input.userId}):`, err);
        });
    } else {
      console.warn(`[push] No push provider selected (user=${input.userId}) — in-app only`);
    }

    return notification;
  }

  async listByUser(organizationId: string, userId: string, limit?: number) {
    await this.repo.prune(organizationId, userId);
    return this.repo.listByUser(organizationId, userId, limit);
  }

  async countUnread(organizationId: string, userId: string) {
    return this.repo.countUnread(organizationId, userId);
  }

  async markAsRead(organizationId: string, userId: string, id: string) {
    return this.repo.markAsRead(organizationId, userId, id);
  }

  async markAllAsRead(organizationId: string, userId: string) {
    return this.repo.markAllAsRead(organizationId, userId);
  }

  async clearRead(organizationId: string, userId: string) {
    return this.repo.deleteRead(organizationId, userId);
  }

  async deleteById(organizationId: string, userId: string, id: string) {
    return this.repo.deleteById(organizationId, userId, id);
  }

  async notifyTaskAssigned(ctx: EventContext, ref: TaskNotificationRef) {
    await this.create({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      title: "New Pick Order",
      body: `${this.orderLabel(ref)} is ready for picking.`,
      type: "TASK_ASSIGNED",
      link: ref.link ?? undefined,
    });
  }

  async notifyShipmentReady(ctx: EventContext, ref: ShipmentNotificationRef) {
    await this.create({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      title: "Delivery Ready",
      body: `Shipment ${ref.shipmentNumber} is loaded and ready for delivery.`,
      type: "SHIPMENT_READY",
      link: ref.link ?? undefined,
    });
  }

  async notifyDeliveryCompleted(ctx: EventContext, ref: ShipmentNotificationRef) {
    await this.create({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      title: "Delivery Completed",
      body: `Shipment ${ref.shipmentNumber} has been delivered.`,
      type: "DELIVERY_COMPLETED",
      link: ref.link ?? undefined,
    });
  }

  async notifyTaskCompleted(ctx: EventContext, ref: TaskNotificationRef) {
    await this.create({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      title: "Picking Completed",
      body: `${this.orderLabel(ref)} has been picked.`,
      type: "TASK_COMPLETED",
      link: ref.link ?? undefined,
    });
  }

  async notifyTaskAvailable(ctx: EventContext, ref: TaskNotificationRef) {
    await this.create({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      title: "Order Ready",
      body: `${this.orderLabel(ref)} is now ready for picking.`,
      type: "TASK_AVAILABLE",
      link: ref.link ?? undefined,
    });
  }

  async notifyTaskScheduled(ctx: EventContext, ref: TaskScheduledNotificationRef) {
    await this.create({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      title: "Scheduled Pick Order",
      body: `${this.orderLabel(ref)} is scheduled for ${this.formatScheduledTime(ref.dueAt, ref.timezone)}.`,
      type: "TASK_SCHEDULED",
      link: ref.link ?? undefined,
    });
  }

  private orderLabel(ref: { soNumber?: string | null; taskNumber?: string }): string {
    return ref.soNumber ? `Order ${ref.soNumber}` : `Task ${ref.taskNumber}`;
  }

  private formatScheduledTime(dueAt: Date, timezone: string): string {
    const dayFmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const dateKey = dayFmt.format(dueAt);
    const todayKey = dayFmt.format(new Date());
    const time = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    }).format(dueAt);

    if (dateKey === todayKey) return `today at ${time}`;

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    if (dateKey === dayFmt.format(tomorrow)) return `tomorrow at ${time}`;

    const dateFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    return `${dateFmt.format(dueAt)} at ${time}`;
  }
}
