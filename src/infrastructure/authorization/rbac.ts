import type { OrganizationRole } from "@prisma/client";

import { BusinessError } from "@/shared/errors/business-error";

import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";

/**
 * WBOS has exactly two roles: OWNER and MANAGER.
 *
 * The previous model ranked seven roles numerically and asked
 * `roleRank[current] >= roleRank[required]`. That had two problems:
 *
 *   - SALES and WAREHOUSE shared rank 30, so each silently inherited the
 *     other's permissions — peers that outranked nobody but each other;
 *   - a rank comparison grants everything BELOW the caller, so any operation
 *     guarded at a lower tier was reachable from above by arithmetic rather
 *     than by an explicit decision. Nothing in the codebase declared which
 *     operations were meant to be owner-only; that fell out of the numbers.
 *
 * There is deliberately no ranking here now. An operation states who may
 * perform it, and nothing widens that by comparison. MANAGER cannot reach an
 * OWNER-only operation, because there is no arithmetic left to reach it with.
 */

/** Every role that may use the ordinary operational and business features. */
const OPERATIONAL_ROLES: readonly OrganizationRole[] = ["OWNER", "MANAGER"];

/** Roles reserved for irreversible or account-level operations. */
const OWNER_ROLES: readonly OrganizationRole[] = ["OWNER"];

function deny(): never {
  throw new BusinessError("You do not have permission to perform this action.", "FORBIDDEN");
}

/**
 * Allow an explicit set of roles.
 *
 * This is the primitive the others are built from, and the one to reach for
 * when an operation is genuinely disjoint rather than tiered.
 */
export function requireAnyRole(
  context: AuthenticatedRequestContext,
  allowedRoles: readonly OrganizationRole[],
) {
  if (!allowedRoles.includes(context.role)) deny();
}

/**
 * Ordinary operational and business work: sales, purchasing, inventory,
 * warehouse tasks, invoicing, settings. OWNER and MANAGER both qualify.
 */
export function requireManager(context: AuthenticatedRequestContext) {
  requireAnyRole(context, OPERATIONAL_ROLES);
}

/**
 * Owner-only work. Reserved for operations that destroy records outright or
 * touch the organization's own data at the account level — deleting sales
 * orders and purchase orders, downloading and restoring backups.
 *
 * MANAGER is not admitted here by any comparison, only by being listed, and
 * it is not listed.
 */
export function requireOwner(context: AuthenticatedRequestContext) {
  requireAnyRole(context, OWNER_ROLES);
}

/** True when the caller may perform ordinary operational work. */
export function canManage(role: OrganizationRole) {
  return OPERATIONAL_ROLES.includes(role);
}

/** True when the caller may perform owner-only work. */
export function isOwner(role: OrganizationRole) {
  return OWNER_ROLES.includes(role);
}
