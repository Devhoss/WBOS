/**
 * Resolve the originating client IP from request headers.
 *
 * WBOS runs behind a reverse proxy that sets `X-Forwarded-For` and `X-Real-IP`
 * (see docs/deployment.md). Per the standard, `X-Forwarded-For` is a comma list
 * in hop order, so the leftmost entry is the real client. We skip the literal
 * "unknown" placeholder some proxies emit.
 *
 * Returns null when no usable IP is present (e.g. a local dev request that did
 * not pass through a proxy) so callers can decide how to behave.
 */
export function getClientIp(headers: Headers): string | null {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    for (const hop of forwardedFor.split(",")) {
      const candidate = hop.trim();
      if (candidate && candidate !== "unknown") {
        return candidate;
      }
    }
  }
  const realIp = headers.get("x-real-ip");
  if (realIp && realIp.trim() && realIp.trim() !== "unknown") {
    return realIp.trim();
  }
  return null;
}
