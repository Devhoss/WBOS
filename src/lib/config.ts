import { join } from "node:path";

export type AppConfig = {
  databaseUrl: string;
  betterAuthSecret: string;
  betterAuthUrl: string;
  internalAppUrl: string | null;
  storageRoot: string;
  backupDir: string;
  appVersion: string;
  nodeEnv: "development" | "production" | "test";
};

export type ConfigValidationResult = {
  ok: boolean;
  missing: string[];
  warnings: string[];
};

function requiredEnvVars(): Array<[key: string, value: string | undefined]> {
  return [
    ["DATABASE_URL", process.env.DATABASE_URL],
    ["BETTER_AUTH_SECRET", process.env.BETTER_AUTH_SECRET],
    ["BETTER_AUTH_URL", process.env.BETTER_AUTH_URL],
  ];
}

function optionalEnvVars(): Array<[key: string, value: string | undefined]> {
  return [
    ["WBOS_STORAGE_ROOT", process.env.WBOS_STORAGE_ROOT],
    ["WBOS_BACKUP_DIR", process.env.WBOS_BACKUP_DIR],
    ["INTERNAL_APP_URL", process.env.INTERNAL_APP_URL],
  ];
}

export function validateConfig(): ConfigValidationResult {
  const missing = requiredEnvVars()
    .filter(([, value]) => !value || value.trim() === "")
    .map(([key]) => key);

  const warnings = optionalEnvVars()
    .filter(([, value]) => !value || value.trim() === "")
    .map(([key]) => `${key} is not set; using default`);

  return { ok: missing.length === 0, missing, warnings };
}

export function getConfig(): AppConfig {
  const validation = validateConfig();
  if (!validation.ok) {
    throw new Error(
      `WBOS is missing required environment variables: ${validation.missing.join(", ")}`,
    );
  }

  return {
    databaseUrl: process.env.DATABASE_URL!,
    betterAuthSecret: process.env.BETTER_AUTH_SECRET!,
    betterAuthUrl: process.env.BETTER_AUTH_URL!,
    internalAppUrl: process.env.INTERNAL_APP_URL ?? null,
    storageRoot: process.env.WBOS_STORAGE_ROOT ?? join(process.cwd(), "public"),
    backupDir: process.env.WBOS_BACKUP_DIR ?? join(process.cwd(), "backups"),
    appVersion: process.env.WBOS_APP_VERSION ?? "0.1.0",
    nodeEnv: (process.env.NODE_ENV === "production" ? "production" : process.env.NODE_ENV === "test" ? "test" : "development"),
  };
}
