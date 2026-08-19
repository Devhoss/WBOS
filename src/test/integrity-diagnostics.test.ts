import { describe, expect, it } from "vitest";

import { INTEGRITY_CHECKS } from "../../scripts/integrity-checks.mjs";
import { exitCodeFor, runCheck, summarise } from "../../scripts/integrity-diagnostics.mjs";

/**
 * The diagnostics script is a deployment gate, so the properties worth pinning
 * are the ones that would make it lie: a check that silently does nothing, a
 * check that writes to the database it is auditing, or a violation that fails
 * to fail the run.
 *
 * The SQL itself is not tested here — it is asserted against a real PostgreSQL
 * every time the script runs, which is the only place it means anything.
 */

type Check = { id: string; name: string; severity: string; sql: string };
const checks = INTEGRITY_CHECKS as readonly Check[];

describe("the check catalogue", () => {
  it("is not empty", () => {
    expect(checks.length).toBeGreaterThan(15);
  });

  it("gives every check a unique id", () => {
    // Ids end up in CI output and in any suppression list built on top.
    const ids = checks.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses only the two severities the runner understands", () => {
    for (const c of checks) {
      expect(["violation", "advisory"], c.id).toContain(c.severity);
    }
  });

  it("names each check as the healthy state, so a PASS line reads true", () => {
    for (const c of checks) {
      expect(c.name.length, c.id).toBeGreaterThan(10);
      expect(c.name, c.id).toBe(c.name.toLowerCase().slice(0, 1) + c.name.slice(1));
    }
  });
});

describe("every check is read-only", () => {
  // The script is documented as safe to run against production. A single
  // stray write would make that false.
  const forbidden = /\b(insert|update|delete|drop|truncate|alter|create|grant)\b/i;

  it.each(checks.map((c) => [c.id, c]))("%s writes nothing", (_id, check) => {
    const sql = (check as Check).sql;
    expect(sql.trimStart().toUpperCase().startsWith("SELECT")).toBe(true);
    expect(forbidden.test(sql)).toBe(false);
  });

  it.each(checks.map((c) => [c.id, c]))("%s returns a single count column", (_id, check) => {
    expect((check as Check).sql).toMatch(/AS n\b/);
  });
});

describe("outcome classification", () => {
  const prismaReturning = (n: number) => ({
    $queryRawUnsafe: async () => [{ n }],
  });
  const prismaThrowing = (message: string) => ({
    $queryRawUnsafe: async () => {
      throw new Error(message);
    },
  });

  const violation = { id: "v", name: "a rule", severity: "violation", sql: "SELECT 1 AS n" } as const;
  const advisory = { id: "a", name: "a note", severity: "advisory", sql: "SELECT 1 AS n" } as const;

  it("counts zero rows as clean, whatever the severity", async () => {
    for (const check of [violation, advisory]) {
      const r = await runCheck(prismaReturning(0), check);
      expect(r.status).toBe("clean");
      expect(r.count).toBe(0);
    }
  });

  it("reports a non-zero violation as a violation", async () => {
    const r = await runCheck(prismaReturning(3), violation);
    expect(r.status).toBe("violation");
    expect(r.count).toBe(3);
  });

  it("reports a non-zero advisory as an advisory, not a violation", async () => {
    const r = await runCheck(prismaReturning(3), advisory);
    expect(r.status).toBe("advisory");
  });

  it("treats a check that cannot run as an error, not a pass", async () => {
    // A check whose table has been renamed must not quietly count as clean.
    const r = await runCheck(prismaThrowing('relation "gone" does not exist'), violation);
    expect(r.status).toBe("error");
    expect(r.count).toBeNull();
    expect(r.error).toContain("gone");
  });
});

describe("exit code", () => {
  const result = (status: string) => ({ status });

  it("is zero when everything is clean", () => {
    expect(exitCodeFor([result("clean"), result("clean")])).toBe(0);
  });

  it("is zero when only advisories are present", () => {
    // Advisories must never block a deployment; the one-fils legacy invoice in
    // the demo data would otherwise fail every run forever.
    expect(exitCodeFor([result("clean"), result("advisory")])).toBe(0);
  });

  it("is non-zero for a violation", () => {
    expect(exitCodeFor([result("clean"), result("violation")])).toBe(1);
  });

  it("is non-zero when a check could not run", () => {
    expect(exitCodeFor([result("clean"), result("error")])).toBe(1);
  });
});

describe("summary counts", () => {
  it("adds up to the number of checks run", () => {
    const results = [
      { status: "clean" },
      { status: "clean" },
      { status: "advisory" },
      { status: "violation" },
      { status: "error" },
    ];
    const s = summarise(results);
    expect(s).toEqual({ clean: 2, advisories: 1, violations: 1, errors: 1, total: 5 });
  });
});
