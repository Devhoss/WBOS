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
    disableCSRFCheck: true,
  },
});

export type AuthSession = typeof auth.$Infer.Session;
