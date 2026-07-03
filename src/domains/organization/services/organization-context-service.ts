import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

/**
 * @deprecated Use AuthenticatedRequestContextService for new code.
 */
export class OrganizationContextService {
  constructor(private readonly requestContext = new AuthenticatedRequestContextService()) {}

  async getCurrentContext() {
    return this.requestContext.getCurrentContext();
  }
}
