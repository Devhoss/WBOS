import { BusinessError } from "@/shared/errors/business-error";

import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";

import { BusinessSettingsRepository } from "../repositories/business-settings-repository";
import type { UpdateBusinessSettingsInput } from "../validation/business-settings-schema";

export class BusinessSettingsService {
  constructor(
    private readonly settings = new BusinessSettingsRepository(),
    private readonly activityLogs = new ActivityLogRepository(),
  ) {}

  async getForContext(context: AuthenticatedRequestContext) {
    const settings = await this.settings.findByOrganizationId(context.organizationId);

    if (!settings) {
      throw new BusinessError("Business settings have not been created for this organization.", "SETTINGS_REQUIRED");
    }

    return settings;
  }

  async updateForContext(context: AuthenticatedRequestContext, input: UpdateBusinessSettingsInput) {
    const settings = await this.settings.updateForOrganization(context.organizationId, input);

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "BUSINESS_SETTINGS_UPDATED",
      entityType: "BusinessSettings",
      entityId: settings.id,
      summary: "Business settings were updated.",
      metadata: {
        businessName: settings.businessName,
        defaultCurrency: settings.defaultCurrency,
        timezone: settings.timezone,
        invoicePrefix: settings.invoicePrefix,
      },
    });

    return settings;
  }
}
