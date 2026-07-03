import type { OrganizationRole } from "@prisma/client";

import { BusinessError } from "@/shared/errors/business-error";

import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";

const roleRank: Record<OrganizationRole, number> = {
  OWNER: 70,
  ADMIN: 60,
  MANAGER: 50,
  FINANCE: 40,
  SALES: 30,
  WAREHOUSE: 30,
  VIEWER: 10,
};

export function hasMinimumRole(currentRole: OrganizationRole, requiredRole: OrganizationRole) {
  return roleRank[currentRole] >= roleRank[requiredRole];
}

export function requireMinimumRole(
  context: AuthenticatedRequestContext,
  requiredRole: OrganizationRole,
) {
  if (!hasMinimumRole(context.role, requiredRole)) {
    throw new BusinessError("You do not have permission to perform this action.", "FORBIDDEN");
  }
}
