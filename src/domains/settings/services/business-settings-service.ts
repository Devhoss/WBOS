import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { BusinessSettingsRepository } from "../repositories/business-settings-repository";
import type { updateBusinessSettingsSchema } from "../validation/business-settings-schema";
import type { z } from "zod";

export class BusinessSettingsService {
  constructor(
    private readonly settings = new BusinessSettingsRepository(),
    private readonly activityLogs = new ActivityLogRepository(),
  ) {}

  async getForContext(context: AuthenticatedRequestContext) {
    const settings = await this.settings.findByOrganizationId(context.organizationId);

    if (!settings) {
      throw new BusinessError("Business settings not found.", "SETTINGS_NOT_FOUND");
    }

    return settings;
  }

  async updateForContext(
    context: AuthenticatedRequestContext,
    input: z.infer<typeof updateBusinessSettingsSchema>,
  ) {
    const result = await this.settings.updateForOrganization(context.organizationId, input);

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "BUSINESS_SETTINGS_UPDATED",
      entityType: "BusinessSettings",
      entityId: result.id,
      summary: "Business settings updated.",
    });

    return result;
  }
}
