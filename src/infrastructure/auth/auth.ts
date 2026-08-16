import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer } from "better-auth/plugins/bearer";

import { prisma } from "@/infrastructure/database/prisma";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL!,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [bearer()],
  trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS
    ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",").map((o) => o.trim())
    : [],
  // Better Auth's built-in limiter is disabled: its IP detection is unreliable
  // behind the multi-hop reverse proxy (falls back to a shared bucket) and its
  // default 3-per-10s sign-in window is stricter than normal usage needs.
  // Rate limiting is handled by src/infrastructure/rate-limit (auth-guard.ts).
  rateLimit: {
    enabled: false,
  },
  advanced: {
    // ⚠ SECURITY-RELEVANT — see docs/CSRF_DECISION.md before changing.
    //
    // Introduced in commit afa4efc alongside the mobile Bearer-token work. In
    // better-auth 1.6.x this flag sets `skipCSRFCheck`, which makes
    // `validateOrigin()` return immediately — so it disables the
    // Origin/Referer-vs-trustedOrigins check for /api/auth/*, not just the
    // Fetch-Metadata form check the name suggests.
    //
    // Current residual protection is the session cookie's SameSite=Lax default,
    // which stops a cross-site POST from carrying credentials at all.
    //
    // Analysis in docs/CSRF_DECISION.md concludes this flag is very likely no
    // longer needed (Bearer requests send no cookie, and validateOrigin already
    // skips cookieless requests), but flipping it changes browser auth behavior
    // and must be verified against web + mobile before go-live. It is therefore
    // env-gated with the existing behavior as the default, so enabling the check
    // is a config change that can be rolled back without a redeploy.
    disableCSRFCheck: process.env.BETTER_AUTH_DISABLE_CSRF !== "0",
  },
});

export type AuthSession = typeof auth.$Infer.Session;
