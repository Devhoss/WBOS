import { AuthSessionService } from "@/infrastructure/auth/auth-session-service";
import { TenantContextService } from "@/infrastructure/tenancy/tenant-context-service";

export class AuthenticatedRequestContextService {
  constructor(
    private readonly authSessions = new AuthSessionService(),
    private readonly tenants = new TenantContextService(),
  ) {}

  async getCurrentContext() {
    const session = await this.authSessions.getRequiredSession();
    const tenant = await this.tenants.getRequiredTenantForUser(session.user.id);

    return {
      user: session.user,
      userId: session.user.id,
      session: session.session,
      organization: tenant.organization,
      organizationId: tenant.organizationId,
      membership: tenant.membership,
      role: tenant.role,
    };
  }
}

export type AuthenticatedRequestContext = Awaited<
  ReturnType<AuthenticatedRequestContextService["getCurrentContext"]>
>;
