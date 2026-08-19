#!/usr/bin/env node
/**
 * Read-only database integrity report.
 *
 * Intended for pre-deployment and post-migration validation: run it against a
 * target before cutting over, and again after `prisma migrate deploy`, to
 * confirm the data still satisfies the invariants the application relies on.
 * It only ever runs SELECTs, so it is safe against production.
 *
 *   node scripts/integrity-diagnostics.mjs           # human-readable
 *   node scripts/integrity-diagnostics.mjs --json    # machine-readable
 *
 * Connects with DATABASE_URL from the environment, via the Prisma client — the
 * same connection the application uses. No credentials are read, printed or
 * stored by this script.
 *
 * Exit codes:
 *   0  every `violation` check is clean (advisories may still be reported)
 *   1  at least one violation, or a check could not run
 *
 * The check catalogue lives in ./integrity-checks.mjs.
 */

import { PrismaClient } from "@prisma/client";

import { INTEGRITY_CHECKS } from "./integrity-checks.mjs";

const asJson = process.argv.includes("--json");

/** Runs one check and returns its outcome, turning a query failure into data. */
export async function runCheck(prisma, check) {
  try {
    const rows = await prisma.$queryRawUnsafe(check.sql);
    const count = Number(rows?.[0]?.n ?? 0);
    return {
      id: check.id,
      name: check.name,
      severity: check.severity,
      count,
      status: count === 0 ? "clean" : check.severity === "advisory" ? "advisory" : "violation",
      error: null,
    };
  } catch (error) {
    // A check that cannot run is not a pass. Most often it means the schema has
    // moved and the check needs updating — which is worth failing over.
    return {
      id: check.id,
      name: check.name,
      severity: check.severity,
      count: null,
      status: "error",
      error: error?.meta?.message ?? error?.message ?? String(error),
    };
  }
}

export function summarise(results) {
  return {
    clean: results.filter((r) => r.status === "clean").length,
    advisories: results.filter((r) => r.status === "advisory").length,
    violations: results.filter((r) => r.status === "violation").length,
    errors: results.filter((r) => r.status === "error").length,
    total: results.length,
  };
}

/** Non-zero when anything is actually wrong; advisories alone do not fail. */
export function exitCodeFor(results) {
  const s = summarise(results);
  return s.violations > 0 || s.errors > 0 ? 1 : 0;
}

const LABEL = {
  clean: "PASS    ",
  advisory: "ADVISORY",
  violation: "FAIL    ",
  error: "ERROR   ",
};

async function main() {
  const prisma = new PrismaClient();
  let target = null;
  try {
    const [row] = await prisma.$queryRaw`
      SELECT current_database() AS db, inet_server_port() AS port`;
    target = `${row.db}:${row.port}`;
  } catch {
    // Reported by the checks themselves if the connection is genuinely broken.
  }

  const results = [];
  for (const check of INTEGRITY_CHECKS) {
    results.push(await runCheck(prisma, check));
  }
  await prisma.$disconnect();

  const summary = summarise(results);

  if (asJson) {
    console.log(JSON.stringify({ target, summary, results }, null, 2));
  } else {
    console.log(`INTEGRITY DIAGNOSTICS${target ? `  (${target})` : ""}\n`);
    for (const r of results) {
      const detail =
        r.status === "error"
          ? `  — ${r.error}`
          : r.count > 0
            ? `  — ${r.count} row${r.count === 1 ? "" : "s"}`
            : "";
      console.log(`  ${LABEL[r.status]} ${r.name}${detail}`);
    }
    console.log(
      `\n  ${summary.clean}/${summary.total} clean` +
        (summary.advisories ? `, ${summary.advisories} advisory` : "") +
        (summary.violations ? `, ${summary.violations} VIOLATION` : "") +
        (summary.errors ? `, ${summary.errors} ERROR` : ""),
    );
  }

  process.exit(exitCodeFor(results));
}

// Importable for tests without running the report.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  await main();
}
