import { NextResponse } from "next/server";

import { BusinessError } from "@/shared/errors/business-error";

import {
  AuthenticatedRequestContextService,
  type AuthenticatedRequestContext,
} from "./authenticated-request-context";

/**
 * Authentication for API route handlers.
 *
 * A route handler must never redirect. `AuthSessionService.getRequiredSession`
 * calls `redirect("/sign-in")` when it is not given override headers, and Next
 * serialises that into a 307. Axios follows redirects, so the mobile app was
 * receiving `200 text/html` — the sign-in page — and running its success path.
 * A failed Deliver reported a completed delivery.
 *
 * Sixteen handlers called `getCurrentContext()` with no argument and were
 * therefore in that state. Passing headers everywhere would fix it today and
 * regress the first time somebody forgets, so authentication for API routes now
 * goes through this function instead, which cannot redirect by construction.
 *
 * It returns a response rather than throwing. Route `catch` blocks map
 * BusinessError to 400/403/404/409 in a dozen different shapes, and an
 * auth failure funnelled through those would surface as whatever that route
 * happened to use — which is how an expired session came back as 403 from
 * `/v1/tasks` and 409 from `/v1/tasks/[id]/pick-actions`. Returning early keeps
 * the existing mapping untouched and guarantees 401.
 */
export type ApiContextResult =
  | { ok: true; context: AuthenticatedRequestContext }
  | { ok: false; response: NextResponse };

export async function apiContext(requestHeaders: Headers): Promise<ApiContextResult> {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext(
      requestHeaders,
    );
    return { ok: true, context };
  } catch (error) {
    if (error instanceof BusinessError && error.code === "AUTH_REQUIRED") {
      return { ok: false, response: unauthorized() };
    }
    // No membership, no organization — authenticated but not provisioned. The
    // client cannot fix this by signing in again, so it must not read as 401.
    if (error instanceof BusinessError) {
      return {
        ok: false,
        response: NextResponse.json({ error: error.message, code: error.code }, { status: 403 }),
      };
    }
    throw error;
  }
}

export function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: "Your session has expired. Please sign in again.", code: "AUTH_REQUIRED" },
    { status: 401 },
  );
}
