import type { OrganizationRole } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";

/**
 * Who should hear about a warehouse event.
 *
 * `SHIPMENT_READY` and `DELIVERY_COMPLETED` were sent to `context.userId` — the
 * person who had just performed the action. The driver who marked a shipment
 * delivered was told that a shipment had been delivered, and the office, which
 * actually needed to know, was told nothing.
 *
 * The recipients are derived from the organization's membership rather than
 * named, so adding a second MANAGER later needs no code change. The actor is
 * excluded: an event is only news to somebody who did not cause it.
 */
const OFFICE_ROLES: readonly OrganizationRole[] = ["OWNER", "MANAGER"];

export async function officeRecipients(
  organizationId: string,
  actorUserId: string,
): Promise<string[]> {
  const members = await prisma.organizationMembership.findMany({
    where: {
      organizationId,
      role: { in: [...OFFICE_ROLES] },
      userId: { not: actorUserId },
    },
    select: { userId: true },
    orderBy: { createdAt: "asc" },
  });

  // A user could in principle hold more than one membership row; one
  // notification per person, not per membership.
  return [...new Set(members.map((m) => m.userId))];
}
