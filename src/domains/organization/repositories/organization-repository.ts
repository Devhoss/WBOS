import { prisma } from "@/infrastructure/database/prisma";

export class OrganizationRepository {
  async findFirstForUser(userId: string) {
    return prisma.organizationMembership.findFirst({
      where: { userId },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    });
  }
}
