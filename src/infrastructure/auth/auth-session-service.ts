import { headers } from "next/headers";

import { auth } from "@/infrastructure/auth/auth";
import { BusinessError } from "@/shared/errors/business-error";

export class AuthSessionService {
  async getRequiredSession(overrideHeaders?: Headers) {
    const hdrs = overrideHeaders ?? (await headers());
    const session = await auth.api.getSession({
      headers: hdrs,
    });

    if (!session?.user.id) {
      throw new BusinessError("You must be signed in to access WBOS.", "AUTH_REQUIRED");
    }

    return session;
  }
}
