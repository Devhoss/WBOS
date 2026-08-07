import { z } from "zod";

export const BACKUP_FORMAT_VERSION = 1;

export const BACKUP_PACKAGE_PREFIX = "wbos-backup-";

export const manifestSchema = z.object({
  formatVersion: z.number().int().min(1),
  appVersion: z.string().min(1),
  createdAt: z.string().datetime(),
  createdBy: z.string().optional(),
  database: z.object({
    file: z.string().min(1),
    bytes: z.number().int().nonnegative(),
    migrations: z.array(z.string()).default([]),
  }),
  uploads: z
    .object({
      file: z.string().min(1),
      bytes: z.number().int().nonnegative(),
    })
    .nullable(),
  config: z.object({ file: z.string().min(1) }),
});

export type BackupManifest = z.infer<typeof manifestSchema>;

export function isManifestCompatible(
  manifest: BackupManifest,
  currentMigrationNames: string[],
): { ok: true } | { ok: false; reason: string } {
  if (manifest.formatVersion > BACKUP_FORMAT_VERSION) {
    return {
      ok: false,
      reason: `Backup was created by a newer WBOS format (v${manifest.formatVersion}). This build supports up to v${BACKUP_FORMAT_VERSION}.`,
    };
  }

  const known = new Set(currentMigrationNames);
  const unknown = manifest.database.migrations.filter((m) => !known.has(m));
  if (unknown.length > 0) {
    return {
      ok: false,
      reason: `Backup was created by a newer WBOS schema and cannot be restored here. Missing migrations: ${unknown.join(", ")}.`,
    };
  }

  return { ok: true };
}
