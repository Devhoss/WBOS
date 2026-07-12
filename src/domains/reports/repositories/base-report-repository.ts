import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

export type ReportDateRange = {
  from?: Date | null;
  to?: Date | null;
};

export class BaseReportRepository {
  protected readonly contextService = new AuthenticatedRequestContextService();

  protected async resolveOrganizationId(organizationId?: string): Promise<string> {
    if (organizationId) return organizationId;
    const context = await this.contextService.getCurrentContext();
    return context.organizationId;
  }

  protected buildDateFilter(dateRange?: ReportDateRange): { gte?: Date; lte?: Date } {
    if (!dateRange) return {};
    const filter: { gte?: Date; lte?: Date } = {};
    if (dateRange.from) filter.gte = new Date(dateRange.from);
    if (dateRange.to) filter.lte = new Date(dateRange.to);
    return filter;
  }

  protected toNumber(value: unknown): number {
    if (value == null) return 0;
    if (typeof value === "number") return value;
    return Number(value);
  }
}
