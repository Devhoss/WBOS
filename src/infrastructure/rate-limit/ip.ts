/**
 * Resolve the originating client IP from request headers.
 *
 * ## Why this is not "read the leftmost X-Forwarded-For"
 *
 * `X-Forwarded-For` is client-controlled. Every proxy APPENDS the address it
 * received the connection from, so the leftmost entry is whatever the original
 * caller chose to send. Trusting it lets an attacker defeat per-IP rate limits
 * outright by sending a different fake leftmost value on every request.
 *
 * The trustworthy entries are the ones written by proxies WE control, and those
 * are at the RIGHT of the list. With N trusted proxies in front of the app, the
 * real client address is the Nth entry counted from the right:
 *
 *   attacker sends:  X-Forwarded-For: 1.2.3.4          (forged)
 *   Caddy appends:   X-Forwarded-For: 1.2.3.4, 203.0.113.7   <- real, rightmost
 *                                               ^ hops = 1
 *
 * Configure the count with `WBOS_TRUSTED_PROXY_HOPS` (default 1, matching the
 * documented single-Caddy deployment). Set it to 0 when the app is NOT behind a
 * proxy — forwarding headers are then ignored entirely and `null` is returned,
 * so per-IP limits are skipped while per-account/per-email limits still apply.
 *
 * Add a hop for every additional trusted proxy in the chain (e.g. Cloudflare in
 * front of Caddy = 2). Setting it too HIGH is fail-closed (returns null, per-IP
 * limiting is skipped); setting it too LOW re-opens the spoofing hole.
 *
 * `X-Real-IP` is only consulted when `WBOS_TRUST_X_REAL_IP=1`, because unlike
 * XFF it carries no hop information — it is trustworthy only if the proxy is
 * known to overwrite it (nginx `proxy_set_header X-Real-IP $remote_addr`) and
 * forgeable otherwise.
 *
 * Returns null when no trustworthy IP is present, so callers can decide how to
 * behave rather than rate-limiting everyone into one shared bucket.
 */

const DEFAULT_TRUSTED_PROXY_HOPS = 1;

function resolveTrustedProxyHops(): number {
  const raw = process.env.WBOS_TRUSTED_PROXY_HOPS;
  if (raw === undefined || raw === "") return DEFAULT_TRUSTED_PROXY_HOPS;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) return DEFAULT_TRUSTED_PROXY_HOPS;
  return parsed;
}

/**
 * Strip an optional port and IPv6 brackets, then confirm the value actually
 * looks like an address. Garbage in a forwarding header must not become a
 * rate-limit bucket key.
 */
function normalizeIp(value: string): string | null {
  let candidate = value.trim();
  if (!candidate || candidate === "unknown") return null;

  // "[::1]:443" / "[::1]" -> "::1"
  const bracketed = candidate.match(/^\[(.+)\](?::\d+)?$/);
  if (bracketed) {
    candidate = bracketed[1];
  } else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(candidate)) {
    // "1.2.3.4:5678" -> "1.2.3.4"  (bare IPv6 keeps its colons)
    candidate = candidate.slice(0, candidate.lastIndexOf(":"));
  }

  const isIpv4 =
    /^\d{1,3}(\.\d{1,3}){3}$/.test(candidate) &&
    candidate.split(".").every((o) => Number(o) <= 255);
  const isIpv6 = candidate.includes(":") && /^[0-9a-fA-F:.]+$/.test(candidate);

  return isIpv4 || isIpv6 ? candidate : null;
}

export function getClientIp(headers: Headers): string | null {
  const hops = resolveTrustedProxyHops();

  // hops = 0: the app is directly exposed, so no forwarding header can be
  // trusted at all.
  if (hops === 0) return null;

  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const parts = forwardedFor
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);

    // Count `hops` from the right. Fewer entries than expected means the chain
    // is shorter than configured (a request that did not traverse the full
    // proxy chain), so nothing here is trustworthy — fail closed.
    const index = parts.length - hops;
    if (index >= 0 && index < parts.length) {
      const ip = normalizeIp(parts[index]);
      if (ip) return ip;
    }
    return null;
  }

  if (process.env.WBOS_TRUST_X_REAL_IP === "1") {
    const realIp = headers.get("x-real-ip");
    if (realIp) return normalizeIp(realIp);
  }

  return null;
}
