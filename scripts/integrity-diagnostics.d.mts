import type { IntegrityCheck } from "./integrity-checks.mjs";

export type CheckStatus = "clean" | "advisory" | "violation" | "error";

export type CheckResult = {
  id: string;
  name: string;
  severity: IntegrityCheck["severity"];
  count: number | null;
  status: CheckStatus;
  error: string | null;
};

/** Minimal surface the runner needs, so tests can pass a stub. */
export type QueryableClient = {
  $queryRawUnsafe: (sql: string) => Promise<Array<{ n: number }>>;
};

export declare function runCheck(
  prisma: QueryableClient,
  check: IntegrityCheck,
): Promise<CheckResult>;

export declare function summarise(results: Array<{ status: string }>): {
  clean: number;
  advisories: number;
  violations: number;
  errors: number;
  total: number;
};

export declare function exitCodeFor(results: Array<{ status: string }>): 0 | 1;
