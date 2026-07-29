/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import { ShipmentRepository } from "@/domains/sales/repositories/shipment-repository";
import { TaskDomainService } from "@/domains/tasks/services/task-domain-service";
import { TaskRepository } from "@/domains/tasks/repositories/task-repository";
import { BusinessError } from "@/shared/errors/business-error";

function mockContext(overrides = {}) {
  return {
    organizationId: "org-1",
    userId: "user-1",
    role: "ADMIN",
    ...overrides,
  } as never;
}

function createMockTask(overrides = {}) {
  return {
    id: "task-1",
    organizationId: "org-1",
    taskNumber: "TSK-2026-000001",
    type: "PICK_ORDER",
    status: "READY",
    priority: "NORMAL",
    title: "Pick SO-000001 — Test Customer",
    subtitle: "5 items, Main Warehouse",
    referenceType: "SALES_ORDER",
    referenceId: "so-1",
    warehouseId: "wh-1",
    assignedToId: "user-2",
    createdById: "user-1",
    data: { shipmentId: "ship-1" },
    dueAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancelledReason: null,
    createdAt: new Date(),
    updatedAt: new Date("2026-07-14T12:00:00Z"),
    warehouse: { id: "wh-1", name: "Main Warehouse", code: "WH1" },
    assignedTo: { id: "user-2", name: "Worker", email: "worker@test.com" },
    createdBy: { id: "user-1", name: "Creator", email: "creator@test.com" },
    lines: [
      {
        id: "tl-1",
        organizationId: "org-1",
        taskId: "task-1",
        referenceLineId: "sl-1",
        completedQuantity: 0,
        status: "PENDING",
        notes: null,
        sortOrder: 1,
      },
    ],
    ...overrides,
  };
}

function mockShipmentDependencies() {
  const mockShipment = {
    id: "ship-1",
    organizationId: "org-1",
    shipmentNumber: "SHP-000001",
    salesOrderId: "so-1",
    warehouseId: "wh-1",
    status: "PENDING_PICK",
    createdById: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    notes: null,
    pickedAt: null,
    loadedAt: null,
    outForDeliveryAt: null,
    deliveredAt: null,
    failedAt: null,
    failureReason: null,
    lines: [
      {
        id: "sl-1",
        organizationId: "org-1",
        shipmentId: "ship-1",
        salesOrderLineId: "sol-1",
        productId: "prod-1",
        quantity: new Prisma.Decimal(10),
        pickedQuantity: new Prisma.Decimal(0),
        productName: "Test Product",
        productSku: "TP-001",
        barcodeVerifiedAt: null,
        notes: null,
        product: { id: "prod-1", sku: "TP-001", name: "Test Product", barcode: "1234567890" },
        salesOrderLine: { orderedQuantity: new Prisma.Decimal(10), shippedQuantity: new Prisma.Decimal(0) },
      },
    ],
    salesOrder: { id: "so-1", soNumber: "SO-000001", customer: { name: "Test Customer" } },
    warehouse: { id: "wh-1", name: "Main Warehouse", code: "WH1" },
    createdBy: { id: "user-1", name: "Creator", email: "creator@test.com" },
    _count: { lines: 1 },
  };

  vi.spyOn(ShipmentRepository.prototype, "findById").mockResolvedValue(mockShipment as any);
  vi.spyOn(ShipmentRepository.prototype, "addPickedQuantity").mockResolvedValue({ count: 1 } as any);
  vi.spyOn(ShipmentRepository.prototype, "updateStatus").mockResolvedValue({ count: 1 } as any);
  vi.spyOn(ActivityLogRepository.prototype, "create").mockResolvedValue({} as any);

  return vi.spyOn(ShipmentRepository.prototype, "addPickedQuantity");
}

describe("TaskDomainService", () => {
  let service: TaskDomainService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TaskDomainService();
  });

  describe("findById", () => {
    it("should return task when found", async () => {
      const mockTask = createMockTask();
      const mockFind = vi.spyOn(TaskRepository.prototype, "findById");
      mockFind.mockResolvedValue(mockTask as any);

      const result = await service.findById("org-1", "task-1");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("task-1");
      expect(result!.taskNumber).toBe("TSK-2026-000001");
      expect(result!.lines).toHaveLength(1);
    });

    it("should return null when not found", async () => {
      const mockFind = vi.spyOn(TaskRepository.prototype, "findById");
      mockFind.mockResolvedValue(null);

      const result = await service.findById("org-1", "nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("start", () => {
    it("should transition from READY to IN_PROGRESS", async () => {
      const mockTask = createMockTask({ status: "READY" });
      vi.spyOn(TaskRepository.prototype, "findById").mockResolvedValue(mockTask as any);
      vi.spyOn(TaskRepository.prototype, "updateStatusWithTimestamp").mockResolvedValue(undefined as never);
      vi.spyOn(TaskRepository.prototype, "findMany").mockResolvedValue({ data: [], total: 0 } as any);

      const result = await service.start(mockContext(), "task-1", mockTask.updatedAt);

      expect(result).not.toBeNull();
      expect(result!.status).toBe("IN_PROGRESS");
      expect(result!.startedAt).toBeInstanceOf(Date);
    });

    it("should reject start when task is not READY", async () => {
      const mockTask = createMockTask({ status: "COMPLETED" });
      vi.spyOn(TaskRepository.prototype, "findById").mockResolvedValue(mockTask as any);

      await expect(
        service.start(mockContext(), "task-1", mockTask.updatedAt),
      ).rejects.toThrow(BusinessError);
    });

    it("should reject start when task not found", async () => {
      vi.spyOn(TaskRepository.prototype, "findById").mockResolvedValue(null);

      await expect(
        service.start(mockContext(), "nonexistent", new Date()),
      ).rejects.toThrow("Task not found");
    });
  });

  describe("complete", () => {
    it("should transition from IN_PROGRESS to COMPLETED", async () => {
      const mockTask = createMockTask({ status: "IN_PROGRESS", startedAt: new Date() });
      vi.spyOn(TaskRepository.prototype, "findById").mockResolvedValue(mockTask as any);
      vi.spyOn(TaskRepository.prototype, "updateStatusWithTimestamp").mockResolvedValue(undefined as never);
      vi.spyOn(TaskRepository.prototype, "findMany").mockResolvedValue({ data: [], total: 0 } as any);

      const result = await service.complete(mockContext(), "task-1", mockTask.updatedAt);

      expect(result).not.toBeNull();
      expect(result!.status).toBe("COMPLETED");
      expect(result!.completedAt).toBeInstanceOf(Date);
    });

    it("should reject complete when task is not IN_PROGRESS", async () => {
      const mockTask = createMockTask({ status: "READY" });
      vi.spyOn(TaskRepository.prototype, "findById").mockResolvedValue(mockTask as any);

      await expect(
        service.complete(mockContext(), "task-1", mockTask.updatedAt),
      ).rejects.toThrow("Task must be IN_PROGRESS");
    });

    it("should reject complete when task not found", async () => {
      vi.spyOn(TaskRepository.prototype, "findById").mockResolvedValue(null);

      await expect(
        service.complete(mockContext(), "nonexistent", new Date()),
      ).rejects.toThrow("Task not found");
    });
  });

  describe("cancel", () => {
    it("should cancel from READY status", async () => {
      const mockTask = createMockTask({ status: "READY" });
      vi.spyOn(TaskRepository.prototype, "findById").mockResolvedValue(mockTask as any);
      vi.spyOn(TaskRepository.prototype, "updateStatusWithTimestamp").mockResolvedValue(undefined as never);
      vi.spyOn(TaskRepository.prototype, "findMany").mockResolvedValue({ data: [], total: 0 } as any);

      const result = await service.cancel(mockContext(), "task-1", "No longer needed", mockTask.updatedAt);

      expect(result).not.toBeNull();
      expect(result!.status).toBe("CANCELLED");
      expect(result!.cancelledReason).toBe("No longer needed");
      expect(result!.cancelledAt).toBeInstanceOf(Date);
    });

    it("should cancel from IN_PROGRESS status", async () => {
      const mockTask = createMockTask({ status: "IN_PROGRESS", startedAt: new Date() });
      vi.spyOn(TaskRepository.prototype, "findById").mockResolvedValue(mockTask as any);
      vi.spyOn(TaskRepository.prototype, "updateStatusWithTimestamp").mockResolvedValue(undefined as never);
      vi.spyOn(TaskRepository.prototype, "findMany").mockResolvedValue({ data: [], total: 0 } as any);

      const result = await service.cancel(mockContext(), "task-1", null, mockTask.updatedAt);

      expect(result).not.toBeNull();
      expect(result!.status).toBe("CANCELLED");
    });

    it("should reject cancel on COMPLETED task", async () => {
      const mockTask = createMockTask({ status: "COMPLETED", completedAt: new Date() });
      vi.spyOn(TaskRepository.prototype, "findById").mockResolvedValue(mockTask as any);

      await expect(
        service.cancel(mockContext(), "task-1", null, mockTask.updatedAt),
      ).rejects.toThrow("Cannot cancel a task in its current state");
    });

    it("should reject cancel on CANCELLED task", async () => {
      const mockTask = createMockTask({ status: "CANCELLED", cancelledAt: new Date() });
      vi.spyOn(TaskRepository.prototype, "findById").mockResolvedValue(mockTask as any);

      await expect(
        service.cancel(mockContext(), "task-1", null, mockTask.updatedAt),
      ).rejects.toThrow("Cannot cancel a task in its current state");
    });
  });

  describe("updateLine", () => {
    it("should update line quantity on IN_PROGRESS task", async () => {
      const mockTask = createMockTask({ status: "IN_PROGRESS", startedAt: new Date() });
      vi.spyOn(TaskRepository.prototype, "findById").mockResolvedValue(mockTask as any);
      vi.spyOn(TaskRepository.prototype, "updateLineQuantity").mockResolvedValue({} as any);
      vi.spyOn(TaskRepository.prototype, "findMany").mockResolvedValue({ data: [], total: 0 } as any);
      mockShipmentDependencies();

      const result = await service.updateLine(mockContext(), "task-1", "tl-1", 5);

      expect(result).not.toBeNull();
      expect(result!.status).toBe("IN_PROGRESS");
    });

    it("should reject line update when task not IN_PROGRESS", async () => {
      const mockTask = createMockTask({ status: "READY" });
      vi.spyOn(TaskRepository.prototype, "findById").mockResolvedValue(mockTask as any);

      await expect(
        service.updateLine(mockContext(), "task-1", "tl-1", 5),
      ).rejects.toThrow("Task is not in progress");
    });

    it("should reject line update for non-existent line", async () => {
      const mockTask = createMockTask({ status: "IN_PROGRESS", startedAt: new Date() });
      vi.spyOn(TaskRepository.prototype, "findById").mockResolvedValue(mockTask as any);

      await expect(
        service.updateLine(mockContext(), "task-1", "nonexistent-line", 5),
      ).rejects.toThrow("Task line not found");
    });

    it("should delegate to ShipmentService for PICK_ORDER tasks", async () => {
      const mockTask = createMockTask({ status: "IN_PROGRESS", startedAt: new Date() });
      vi.spyOn(TaskRepository.prototype, "findById").mockResolvedValue(mockTask as any);
      vi.spyOn(TaskRepository.prototype, "updateLineQuantity").mockResolvedValue({} as any);
      vi.spyOn(TaskRepository.prototype, "findMany").mockResolvedValue({ data: [], total: 0 } as any);
      const addPickSpy = mockShipmentDependencies();

      const result = await service.updateLine(mockContext(), "task-1", "tl-1", 5);

      expect(result).not.toBeNull();
      expect(addPickSpy).toHaveBeenCalled();
    });
  });

  describe("state transition enforcement", () => {
    it("should produce no conflicting states", async () => {
      const scenarios = [
        { from: "READY", to: "COMPLETED", shouldThrow: true },
        { from: "READY", to: "CANCELLED", shouldThrow: false },
        { from: "READY", to: "IN_PROGRESS", shouldThrow: false },
        { from: "IN_PROGRESS", to: "COMPLETED", shouldThrow: false },
        { from: "IN_PROGRESS", to: "CANCELLED", shouldThrow: false },
        { from: "IN_PROGRESS", to: "IN_PROGRESS", shouldThrow: false },
        { from: "COMPLETED", to: "CANCELLED", shouldThrow: true },
        { from: "COMPLETED", to: "COMPLETED", shouldThrow: true },
        { from: "CANCELLED", to: "COMPLETED", shouldThrow: true },
      ];

      for (const scenario of scenarios) {
        vi.clearAllMocks();

        const mockTask = createMockTask({ status: scenario.from });
        vi.spyOn(TaskRepository.prototype, "findById").mockResolvedValue(mockTask as any);

        if (scenario.to === "COMPLETED") {
          if (scenario.shouldThrow) {
            await expect(
              service.complete(mockContext(), "task-1", mockTask.updatedAt),
            ).rejects.toThrow(BusinessError);
          } else {
            vi.spyOn(TaskRepository.prototype, "updateStatusWithTimestamp").mockResolvedValue(undefined as never);
            vi.spyOn(TaskRepository.prototype, "findMany").mockResolvedValue({ data: [], total: 0 } as any);
            const result = await service.complete(mockContext(), "task-1", mockTask.updatedAt);
            expect(result.status).toBe("COMPLETED");
          }
        } else if (scenario.to === "CANCELLED") {
          if (scenario.shouldThrow) {
            await expect(
              service.cancel(mockContext(), "task-1", null, mockTask.updatedAt),
            ).rejects.toThrow(BusinessError);
          } else {
            vi.spyOn(TaskRepository.prototype, "updateStatusWithTimestamp").mockResolvedValue(undefined as never);
            vi.spyOn(TaskRepository.prototype, "findMany").mockResolvedValue({ data: [], total: 0 } as any);
            const result = await service.cancel(mockContext(), "task-1", null, mockTask.updatedAt);
            expect(result.status).toBe("CANCELLED");
          }
        }
      }
    });
  });
});
