import { auth } from "@/infrastructure/auth/auth";
import { withAuthRateLimit } from "@/infrastructure/rate-limit/auth-guard";

const handler = withAuthRateLimit((req: Request) => auth.handler(req));

export const GET = handler;
export const POST = handler;
