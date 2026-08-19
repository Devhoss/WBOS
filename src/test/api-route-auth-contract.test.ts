import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Every API route must answer an unauthenticated request with 401 — never a
 * redirect.
 *
 * `AuthSessionService.getRequiredSession` calls `redirect("/sign-in")` when it
 * is not handed override headers. That is right for a page and catastrophic for
 * a route handler: Next serialises it into a 307, the mobile client follows it,
 * and a 200 carrying the HTML sign-in page comes back. `deliverShipment`
 * resolved against that page and reported a delivery that never happened.
 *
 * Sixteen handlers were in that state. Passing headers at each call site would
 * have fixed it until the next handler forgot, so route authentication now goes
 * through `apiContext`, which cannot redirect. This test is what keeps it that
 * way.
 */

const API_ROOT = join(process.cwd(), "src", "app", "api");

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...routeFiles(full));
    else if (entry === "route.ts") out.push(full);
  }
  return out;
}

const routes = routeFiles(API_ROOT);
const rel = (f: string) => relative(API_ROOT, f).split(sep).join("/");

describe("API routes authenticate without redirecting", () => {
  it("finds the route files", () => {
    expect(routes.length).toBeGreaterThan(30);
  });

  it.each(routes.map((f) => [rel(f), f]))(
    "%s does not call getCurrentContext directly",
    (_name, file) => {
      const source = readFileSync(file, "utf8");
      // The service itself is fine to import; calling it from a route is not,
      // because a bare call redirects instead of throwing.
      expect(source).not.toMatch(/getCurrentContext\s*\(/);
    },
  );

  it.each(routes.map((f) => [rel(f), f]))(
    "%s reaches its context through apiContext",
    (_name, file) => {
      const source = readFileSync(file, "utf8");
      if (!/\bcontext\b/.test(source)) return; // genuinely public route
      expect(source).toMatch(/apiContext\(/);
    },
  );

  it.each(routes.map((f) => [rel(f), f]))(
    "%s returns the guard result before doing any work",
    (_name, file) => {
      const source = readFileSync(file, "utf8");
      if (!source.includes("apiContext(")) return;
      // Every `const auth = await apiContext(...)` must be immediately
      // followed by the early return; an unguarded `auth.context` would be
      // undefined at runtime with no type error to catch it.
      const calls = source.match(/const auth = await apiContext\([^)]*\);\s*\n\s*/g) ?? [];
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) {
        const after = source.slice(source.indexOf(call) + call.length);
        // The response itself is the route's business -- the uploads route
        // answers 401 with no body to match its own convention. What must not
        // vary is that a failed guard returns immediately, before any work.
        expect(after).toMatch(/^if \(!auth\.ok\) return /);
      }
    },
  );
});
