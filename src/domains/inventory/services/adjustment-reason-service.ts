import type { InventoryDirection } from "@prisma/client";

import { AdjustmentReasonRepository } from "../repositories/adjustment-reason-repository";

const defaultReasons: Array<{
  name: string;
  code: string;
  direction?: InventoryDirection;
}> = [
  { name: "Opening Balance", code: "OPENING_BALANCE", direction: "IN" },
  { name: "Damage", code: "DAMAGE", direction: "OUT" },
  { name: "Lost", code: "LOST", direction: "OUT" },
  { name: "Expired", code: "EXPIRED", direction: "OUT" },
  { name: "Count Correction", code: "COUNT_CORRECTION" },
  { name: "Manual Correction", code: "MANUAL_CORRECTION" },
];

export class AdjustmentReasonService {
  constructor(private readonly reasons = new AdjustmentReasonRepository()) {}

  async ensureDefaults(organizationId: string) {
    await this.reasons.createMany(
      defaultReasons.map((reason) => ({
        organizationId,
        name: reason.name,
        code: reason.code,
        direction: reason.direction,
        isSystem: true,
      })),
    );
  }

  async listActive(organizationId: string) {
    await this.ensureDefaults(organizationId);
    return this.reasons.listActive(organizationId);
  }

  async findActiveByCode(organizationId: string, code: string) {
    await this.ensureDefaults(organizationId);
    return this.reasons.findActiveByCode(organizationId, code);
  }
}
