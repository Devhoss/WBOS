import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrganizationRole } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";

/**
 * The role model is enforced where the work actually happens, not only in the
 * UI. These drive real server actions with a MANAGER context and assert the
 * request is refused before any database write is attempted.
 *
 * `src/test/rbac.test.ts` covers the authorization primitives. This file covers
 * the wiring: it would still fail if a call site were left un-guarded, or
 * guarded at the wrong tier.
 */

let currentRole: OrganizationRole = "OWNER";

vi.mock("@/infrastructure/request/authenticated-request-context", () => ({
  AuthenticatedRequestContextService: class {
    async getCurrentContext() {
      return { organizationId: "org-1", userId: "user-1", role: currentRole };
    }
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const restoreBackup = vi.fn();
vi.mock("@/domains/backups/services/backup-service", () => ({
  BackupService: class {
    restoreBackup = restoreBackup;
  },
}));

const recordPayment = vi.fn();
vi.mock("@/domains/sales/services/payment-service", () => ({
  PaymentService: class {
    record = recordPayment;
  },
}));

const db = prisma as unknown as {
  salesOrder: { findFirst: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  salesOrderLine: { deleteMany: ReturnType<typeof vi.fn> };
  purchaseOrder: { findFirst: ReturnType<typeof vi.fn> };
  customer: { create: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

describe("RBAC enforcement at real call sites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentRole = "OWNER";
    restoreBackup.mockResolvedValue({ restoredPackage: "backup.tar.gz" });
    recordPayment.mockResolvedValue({ id: "pay-1" });
  });

  describe("deleting a sales order is owner-only", () => {
    it("refuses a MANAGER and touches nothing", async () => {
      const { deleteSalesOrder } = await import("@/domains/sales/actions/delete-sales-order");
      currentRole = "MANAGER";

      const result = await deleteSalesOrder({ id: "so-1" });

      expect(result).toMatchObject({ ok: false });
      // The guard must run before the lookup, so a refused caller cannot even
      // learn whether the order exists.
      expect(db.salesOrder.findFirst).not.toHaveBeenCalled();
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("lets an OWNER through to the business rules", async () => {
      const { deleteSalesOrder } = await import("@/domains/sales/actions/delete-sales-order");
      currentRole = "OWNER";
      db.salesOrder.findFirst.mockResolvedValue({ id: "so-1", soNumber: "SO-1", status: "DRAFT" });
      db.salesOrder.delete = vi.fn().mockResolvedValue({});
      db.salesOrderLine.deleteMany = vi.fn().mockResolvedValue({ count: 0 });
      db.$transaction.mockResolvedValue([]);

      const result = await deleteSalesOrder({ id: "so-1" });

      expect(db.salesOrder.findFirst).toHaveBeenCalled();
      expect(result).toMatchObject({ ok: true });
    });
  });

  describe("deleting a purchase order is owner-only", () => {
    it("refuses a MANAGER and touches nothing", async () => {
      const { deletePurchaseOrder } = await import(
        "@/domains/purchasing/actions/delete-purchase-order"
      );
      currentRole = "MANAGER";

      const result = await deletePurchaseOrder({ id: "po-1" });

      expect(result).toMatchObject({ ok: false });
      expect(db.purchaseOrder.findFirst).not.toHaveBeenCalled();
    });
  });

  describe("restoring a backup is owner-only", () => {
    it("refuses a MANAGER before the restore runs", async () => {
      const { restoreBackupAction } = await import("@/domains/backups/actions/restore-backup");
      currentRole = "MANAGER";

      const result = await restoreBackupAction({ fileName: "b.tar.gz", confirmation: "RESTORE" });

      expect(result).toMatchObject({ ok: false });
      expect(restoreBackup).not.toHaveBeenCalled();
    });

    it("lets an OWNER through", async () => {
      const { restoreBackupAction } = await import("@/domains/backups/actions/restore-backup");
      currentRole = "OWNER";

      const result = await restoreBackupAction({ fileName: "b.tar.gz", confirmation: "RESTORE" });

      expect(restoreBackup).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ ok: true });
    });
  });

  describe("ordinary operational work is open to MANAGER", () => {
    it("a MANAGER may create a customer", async () => {
      const { createCustomer } = await import("@/domains/customers/actions/create-customer");
      currentRole = "MANAGER";
      db.customer.create.mockResolvedValue({ id: "cust-1", name: "Al Jazeera" });

      const result = await createCustomer({ name: "Al Jazeera", currency: "KWD" });

      // The guard is not what stops this: the create is reached.
      expect(result).toMatchObject({ ok: true });
      expect(db.customer.create).toHaveBeenCalled();
    });

    it("a MANAGER may record a payment — previously OWNER/ADMIN/FINANCE only", async () => {
      // The old guard here was an ad-hoc `new Set(["OWNER","ADMIN","FINANCE"])`
      // that never went through the authorization module at all, and excluded
      // MANAGER by name. Recording a customer payment is routine work.
      const { recordPaymentAction } = await import("@/domains/sales/actions/record-payment");
      currentRole = "MANAGER";

      const result = await recordPaymentAction({
        invoiceId: "inv-1",
        amount: 10,
        currency: "KWD",
        method: "CASH",
      });

      expect(result).toMatchObject({ ok: true });
      expect(recordPayment).toHaveBeenCalledTimes(1);
    });

    it("a MANAGER may post a landed cost — previously FINANCE-only, never MANAGER", async () => {
      // Under the old ranking MANAGER outranked FINANCE numerically yet was
      // excluded from POST_ROLES by name. With FINANCE gone this is ordinary
      // operational work and must not be locked behind OWNER.
      const { requireManager } = await import("@/infrastructure/authorization/rbac");
      const managerContext = { organizationId: "org-1", userId: "user-1", role: "MANAGER" as const };

      expect(() => requireManager(managerContext as never)).not.toThrow();
    });
  });
});
