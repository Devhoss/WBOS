import { describe, expect, it } from "vitest";
import type { OrganizationRole } from "@prisma/client";

import {
  canManage,
  isOwner,
  requireAnyRole,
  requireManager,
  requireOwner,
} from "@/infrastructure/authorization/rbac";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";

/**
 * WBOS has two roles. The point of these tests is not that the two happy paths
 * work — it is that MANAGER cannot reach an OWNER-only operation.
 *
 * The previous model ranked seven roles numerically and asked
 * `roleRank[current] >= roleRank[required]`. Under that scheme an operation was
 * reachable from above by arithmetic rather than by an explicit decision, and
 * SALES and WAREHOUSE shared a rank so each inherited the other's permissions.
 * Nothing declared which operations were owner-only; it fell out of the numbers.
 */

function ctx(role: OrganizationRole): AuthenticatedRequestContext {
  return { organizationId: "org-1", userId: "user-1", role } as AuthenticatedRequestContext;
}

const OWNER = ctx("OWNER");
const MANAGER = ctx("MANAGER");

describe("RBAC: OWNER and MANAGER", () => {
  describe("manager operations", () => {
    it("MANAGER can perform ordinary operational work", () => {
      expect(() => requireManager(MANAGER)).not.toThrow();
    });

    it("OWNER can perform ordinary operational work too", () => {
      expect(() => requireManager(OWNER)).not.toThrow();
    });
  });

  describe("owner-only operations", () => {
    it("OWNER can perform owner-only work", () => {
      expect(() => requireOwner(OWNER)).not.toThrow();
    });

    it("MANAGER cannot perform owner-only work", () => {
      expect(() => requireOwner(MANAGER)).toThrow(
        "You do not have permission to perform this action.",
      );
    });

    it("the refusal is a FORBIDDEN business error, not a raw throw", () => {
      expect(() => requireOwner(MANAGER)).toThrow(
        expect.objectContaining({ code: "FORBIDDEN" }) as never,
      );
    });

    it("MANAGER is refused no matter how the check is spelled", () => {
      // There is no ranking left, so there is no comparison that admits MANAGER
      // to an owner-only operation as a side effect of being "high enough".
      expect(() => requireAnyRole(MANAGER, ["OWNER"])).toThrow();
      expect(canManage("MANAGER")).toBe(true);
      expect(isOwner("MANAGER")).toBe(false);
      expect(isOwner("OWNER")).toBe(true);
    });
  });

  describe("explicit role sets", () => {
    it("admits exactly the roles named and nothing else", () => {
      expect(() => requireAnyRole(OWNER, ["OWNER", "MANAGER"])).not.toThrow();
      expect(() => requireAnyRole(MANAGER, ["OWNER", "MANAGER"])).not.toThrow();
      expect(() => requireAnyRole(MANAGER, ["OWNER"])).toThrow();
      expect(() => requireAnyRole(OWNER, ["MANAGER"])).toThrow();
    });

    it("an empty allow-list admits nobody", () => {
      expect(() => requireAnyRole(OWNER, [])).toThrow();
      expect(() => requireAnyRole(MANAGER, [])).toThrow();
    });
  });

  describe("the removed peer roles are gone from the model", () => {
    it("exports no rank table and no minimum-role comparison", async () => {
      const rbac = await import("@/infrastructure/authorization/rbac");
      expect(Object.keys(rbac)).not.toContain("hasMinimumRole");
      expect(Object.keys(rbac)).not.toContain("requireMinimumRole");
      expect(Object.keys(rbac)).not.toContain("roleRank");
    });

    it("treats a removed role value as unauthorized rather than ranking it", () => {
      // Defence in depth: the enum no longer permits these, but a stale session
      // or a hand-edited row must not be silently ranked into permissions.
      for (const stale of ["ADMIN", "SALES", "WAREHOUSE", "FINANCE", "VIEWER"]) {
        const stray = ctx(stale as OrganizationRole);
        expect(() => requireManager(stray)).toThrow();
        expect(() => requireOwner(stray)).toThrow();
        expect(canManage(stale as OrganizationRole)).toBe(false);
        expect(isOwner(stale as OrganizationRole)).toBe(false);
      }
    });
  });
});
