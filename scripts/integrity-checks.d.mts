export type CheckSeverity = "violation" | "advisory";

export type IntegrityCheck = {
  id: string;
  name: string;
  severity: CheckSeverity;
  sql: string;
};

export declare const INTEGRITY_CHECKS: readonly IntegrityCheck[];
