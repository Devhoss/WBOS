import { headers } from "next/headers";

import { auth } from "@/infrastructure/auth/auth";
import { BusinessError } from "@/shared/errors/business-error";

export class AuthSessionService {
  async getRequiredSession() {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user.id) {
      throw new BusinessError("You must be signed in to access WBOS.", "AUTH_REQUIRED");
    }

    return session;
  }
}
