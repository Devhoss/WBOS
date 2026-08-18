import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { promisify } from "node:util";
import { existsSync } from "node:fs";

import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { BACKUP_PACKAGE_PREFIX, isManifestCompatible, manifestSchema, type BackupManifest } from "../backup-format";

const execFileAsync = promisify(execFile);

export type RunOptions = {
  env?: NodeJS.ProcessEnv;
};

export type PgConnectionInfo = {
  host: string;
  port: number;
  user: string;
  database: string;
  password: string;
};

const TOOL_NAMES: Record<string, string> = {
  pg_dump: "PostgreSQL backup tool",
  pg_restore: "PostgreSQL restore tool",
  tar: "archive tool",
};

const TOOL_HINT =
  "See docs/PRODUCTION_READINESS.md for installation instructions (postgresql-client + tar).";

export function parseDatabaseUrl(databaseUrl: string): PgConnectionInfo {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new BusinessError("DATABASE_URL is not a valid PostgreSQL connection string.", "BACKUP_DB_URL_INVALID");
  }
  if (!url.hostname) {
    throw new BusinessError("DATABASE_URL is not a valid PostgreSQL connection string.", "BACKUP_DB_URL_INVALID");
  }
  const user = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    user,
    database,
    password,
  };
}

export type BackupPackageMeta = {
  fileName: string;
  createdAt: string;
  bytes: number;
  manifest: BackupManifest;
};

export type BackupStatus = {
  lastBackupAt: string | null;
  /**
   * The MOST RECENT restore test, whatever its outcome — check `result` before
   * treating it as proof the backups are restorable.
   */
  lastRestoreTest: {
    at: string;
    packageName: string;
    result: string;
    reason?: string | null;
  } | null;
};

type RestoreHistoryEntry = {
  at: string;
  packageName: string;
  result: string;
  performedBy: string;
  reason?: string | null;
};

export type ToolCheck = {
  tool: string;
  label: string;
  ok: boolean;
  version?: string;
  error?: string;
};

export type BackupDiagnostics = {
  path: string;
  tools: ToolCheck[];
};

const ALL_BACKUP_TOOLS = ["pg_dump", "pg_restore", "tar"] as const;

export class BackupService {
  constructor(
    private readonly backupRoot: string = process.env.WBOS_BACKUP_DIR ?? join(process.cwd(), "backups"),
    private readonly storageRoot: string = process.env.WBOS_STORAGE_ROOT ?? join(process.cwd(), "storage"),
    private readonly databaseUrl: string | undefined = process.env.DATABASE_URL,
    private readonly migrationDir: string = join(process.cwd(), "prisma", "migrations"),
    private readonly run: (
      file: string,
      args: readonly string[],
      options?: RunOptions,
    ) => Promise<{ stdout: string; stderr: string }> = execFileAsync,
  ) {}

  private get packagesDir() {
    return join(this.backupRoot, "packages");
  }

  private get restoreHistoryFile() {
    return join(this.backupRoot, "restore-history.json");
  }

  async checkTools(tools: readonly string[] = ALL_BACKUP_TOOLS): Promise<ToolCheck[]> {
    const checks: ToolCheck[] = [];
    for (const tool of tools) {
      const label = TOOL_NAMES[tool] ?? "required tool";
      try {
        const result = await this.run(tool, ["--version"]);
        checks.push({
          tool,
          label,
          ok: true,
          version: (result.stdout || result.stderr || "").trim().split("\n")[0] || undefined,
        });
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        const stderr = (error as { stderr?: string }).stderr;
        checks.push({
          tool,
          label,
          ok: false,
          error: code === "ENOENT" ? "not found in PATH" : (stderr || (error instanceof Error ? error.message : String(error))),
        });
        console.error(`[backup] tool probe failed: ${tool} --version`, {
          code,
          stderr,
          pathSnippet: (process.env.PATH ?? "").split(/(?:;|:)/).filter((p) => /pg/i.test(p)),
        });
      }
    }
    return checks;
  }

  async getDiagnostics(): Promise<BackupDiagnostics> {
    const tools = await this.checkTools();
    return { path: process.env.PATH ?? "", tools };
  }

  private async assertToolsAvailable(tools: readonly string[]): Promise<void> {
    const checks = await this.checkTools(tools);
    const missing = checks.filter((c) => !c.ok);
    if (missing.length > 0) {
      const lines = missing.map((c) => `\n  - ${c.tool} (${c.label}) — ${c.error ?? "unavailable"}`).join("");
      throw new BusinessError(
        `Required backup tools are not installed or not available in PATH:${lines}\n${TOOL_HINT}`,
        "BACKUP_TOOLS_MISSING",
      );
    }
  }

  private async readManifest(packageDir: string): Promise<BackupManifest> {
    const raw = await readFile(join(packageDir, "manifest.json"), "utf8");
    const parsed = manifestSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      throw new BusinessError("Backup manifest is invalid.", "BACKUP_MANIFEST_INVALID");
    }
    return parsed.data;
  }

  async listBackups(): Promise<BackupPackageMeta[]> {
    if (!existsSync(this.packagesDir)) {
      return [];
    }
    const files = (await readdir(this.packagesDir)).filter(
      (f) => f.startsWith(BACKUP_PACKAGE_PREFIX) && f.endsWith(".tar.gz"),
    );
    const results: BackupPackageMeta[] = [];
    for (const fileName of files) {
      const filePath = join(this.packagesDir, fileName);
      const statResult = await stat(filePath);
      results.push({
        fileName,
        createdAt: statResult.mtime.toISOString(),
        bytes: statResult.size,
        manifest: { formatVersion: 0, appVersion: "", createdAt: "", database: { file: "", bytes: 0, migrations: [] }, uploads: null, config: { file: "" } },
      });
    }
    results.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return results;
  }

  async getStatus(): Promise<BackupStatus> {
    const backups = await this.listBackups();
    const lastBackupAt = backups.length > 0 ? backups[0].createdAt : null;

    let lastRestoreTest: BackupStatus["lastRestoreTest"] = null;
    if (existsSync(this.restoreHistoryFile)) {
      const raw = await readFile(this.restoreHistoryFile, "utf8");
      const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
      // Report the LATEST entry regardless of result. Skipping ahead to the last
      // successful run would keep showing a stale "PASS" after the restore path
      // had started failing — which is precisely the failure this indicator
      // exists to catch.
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const entry = JSON.parse(lines[i]) as RestoreHistoryEntry;
          lastRestoreTest = {
            at: entry.at,
            packageName: entry.packageName,
            result: entry.result,
            reason: entry.reason ?? null,
          };
          break;
        } catch {
          // skip malformed lines
        }
      }
    }

    return { lastBackupAt, lastRestoreTest };
  }

  /**
   * Removes staging directories abandoned by a previous run.
   *
   * createBackup/restoreBackup/verifyPackage each clean up in a `finally`, but a
   * `finally` cannot run if the process is killed mid-backup (OOM, SIGKILL,
   * container eviction, a hard tar crash). A backup staging directory holds a
   * full database dump plus every uploaded file, so a handful of orphans can
   * fill the disk — and the disk filling up is exactly what stops the next
   * backup from succeeding.
   *
   * Deliberately conservative: only this service's own prefixes are considered,
   * and only entries older than `minAgeMs`, so a concurrently running backup is
   * never touched. Failures are swallowed — a sweep must never be the reason a
   * backup does not happen.
   */
  async sweepOrphanedStaging(minAgeMs = 6 * 60 * 60 * 1000): Promise<string[]> {
    const prefixes = ["wbos-backup-", "wbos-restore-", "wbos-verify-"];
    const removed: string[] = [];
    const cutoff = Date.now() - minAgeMs;
    const tmp = tmpdir();

    let entries: string[];
    try {
      entries = await readdir(tmp);
    } catch {
      return removed;
    }

    for (const entry of entries) {
      if (!prefixes.some((prefix) => entry.startsWith(prefix))) continue;
      const full = join(tmp, entry);
      try {
        const info = await stat(full);
        // Packages themselves are files (.tar.gz); staging dirs are directories.
        if (!info.isDirectory()) continue;
        if (info.mtimeMs > cutoff) continue;
        await rm(full, { recursive: true, force: true });
        removed.push(entry);
      } catch {
        // Busy, permission-denied, or already gone — leave it for the next run.
      }
    }

    if (removed.length > 0) {
      console.warn(`[backup] Reclaimed ${removed.length} orphaned staging director${removed.length === 1 ? "y" : "ies"}.`);
    }

    return removed;
  }

  async createBackup(context: AuthenticatedRequestContext): Promise<BackupPackageMeta> {
    if (!this.databaseUrl) {
      throw new BusinessError("DATABASE_URL is not configured; cannot create a backup.", "BACKUP_DB_URL_MISSING");
    }
    await this.assertToolsAvailable(["pg_dump", "tar"]);
    await this.sweepOrphanedStaging();

    const now = new Date();
    const timestamp = [
      now.getUTCFullYear(),
      String(now.getUTCMonth() + 1).padStart(2, "0"),
      String(now.getUTCDate()).padStart(2, "0"),
      "_",
      String(now.getUTCHours()).padStart(2, "0"),
      String(now.getUTCMinutes()).padStart(2, "0"),
      String(now.getUTCSeconds()).padStart(2, "0"),
    ].join("");
    const packageFileName = `${BACKUP_PACKAGE_PREFIX}${timestamp}.tar.gz`;
    const packagesDir = this.packagesDir;
    const staging = await mkdtemp(join(tmpdir(), "wbos-backup-"));
    const stagePackageDir = join(staging, `wbos-backup-${timestamp}`);

    try {
      await mkdir(stagePackageDir, { recursive: true });

      const dumpFile = join(stagePackageDir, "database.dump");
      const conn = parseDatabaseUrl(this.databaseUrl);
      await this.run(
        "pg_dump",
        ["-Fc", "--no-owner", "--no-privileges", "-h", conn.host, "-p", String(conn.port), "-U", conn.user, "-d", conn.database, "-f", dumpFile],
        { env: { ...process.env, PGPASSWORD: conn.password } },
      );
      const dumpStat = await stat(dumpFile);

      let uploadsArchive: { file: string; bytes: number } | null = null;
      if (existsSync(this.storageRoot)) {
        const uploadsFile = join(stagePackageDir, "uploads.tar.gz");
        const parent = this.storageRoot.replace(/[/\\]$/, "");
        const leaf = basename(parent);
        const archiveDir = parent.substring(0, parent.length - leaf.length) || ".";
        await this.run("tar", ["czf", uploadsFile, "-C", archiveDir, leaf]);
        if (existsSync(uploadsFile)) {
          const upStat = await stat(uploadsFile);
          uploadsArchive = { file: "uploads.tar.gz", bytes: upStat.size };
        }
      }

      const migrations = await this.listAppliedMigrations();

      const config = {
        wbosStorageRoot: process.env.WBOS_STORAGE_ROOT ?? null,
        wbosBackupDir: process.env.WBOS_BACKUP_DIR ?? null,
        internalAppUrl: process.env.INTERNAL_APP_URL ?? null,
        betterAuthUrl: process.env.BETTER_AUTH_URL ?? null,
        nodeEnv: process.env.NODE_ENV ?? null,
      };

      const manifest: BackupManifest = {
        formatVersion: 1,
        appVersion: process.env.WBOS_APP_VERSION ?? "0.1.0",
        createdAt: new Date().toISOString(),
        createdBy: context.user?.email ?? context.userId,
        database: { file: "database.dump", bytes: dumpStat.size, migrations },
        uploads: uploadsArchive,
        config: { file: "config.json" },
      };

      await writeFile(join(stagePackageDir, "manifest.json"), JSON.stringify(manifest, null, 2));
      await writeFile(join(stagePackageDir, "config.json"), JSON.stringify(config, null, 2));

      await mkdir(packagesDir, { recursive: true });
      await this.run("tar", ["czf", join(packagesDir, packageFileName), "-C", staging, `wbos-backup-${timestamp}`]);

      const finalStat = await stat(join(packagesDir, packageFileName));
      const result = { fileName: packageFileName, createdAt: manifest.createdAt, bytes: finalStat.size, manifest };

      try {
        await this.verifyPackage(packageFileName);
      } catch (error) {
        await rm(join(packagesDir, packageFileName), { force: true }).catch(() => {});
        throw error;
      }

      return result;
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
  }

  async restoreBackup(context: AuthenticatedRequestContext, packageFileName: string, confirmation: string) {
    if (confirmation !== "RESTORE") {
      throw new BusinessError("Type RESTORE to confirm this destructive restore.", "BACKUP_RESTORE_NOT_CONFIRMED");
    }
    if (!this.databaseUrl) {
      throw new BusinessError("DATABASE_URL is not configured; cannot restore.", "BACKUP_DB_URL_MISSING");
    }
    await this.assertToolsAvailable(["pg_restore", "tar"]);

    const packagePath = join(this.packagesDir, basename(packageFileName));
    if (!existsSync(packagePath)) {
      throw new BusinessError("Backup package was not found.", "BACKUP_PACKAGE_NOT_FOUND");
    }

    const staging = await mkdtemp(join(tmpdir(), "wbos-restore-"));
    try {
      const { packageDir, manifest } = await this.extractPackage(staging, packagePath);

      const currentMigrations = await this.listAppliedMigrations();
      const compat = isManifestCompatible(manifest, currentMigrations);
      if (!compat.ok) {
        throw new BusinessError(compat.reason, "BACKUP_INCOMPATIBLE");
      }

      const dumpFile = join(packageDir, manifest.database.file);
      const conn = parseDatabaseUrl(this.databaseUrl);
      await this.run(
        "pg_restore",
        ["--clean", "--if-exists", "--no-owner", "--no-privileges", "-h", conn.host, "-p", String(conn.port), "-U", conn.user, "-d", conn.database, dumpFile],
        { env: { ...process.env, PGPASSWORD: conn.password } },
      );

      if (manifest.uploads) {
        const uploadsFile = join(packageDir, manifest.uploads.file);
        if (existsSync(uploadsFile)) {
          const parent = this.storageRoot.replace(/[/\\]$/, "");
          const leaf = basename(parent);
          const archiveDir = parent.substring(0, parent.length - leaf.length) || ".";
          await mkdir(archiveDir, { recursive: true });
          await this.run("tar", ["xzf", uploadsFile, "-C", archiveDir]);
        }
      }

      await this.appendRestoreHistory({
        at: new Date().toISOString(),
        packageName: packageFileName,
        result: "success",
        performedBy: context.user?.email ?? context.userId,
      });

      return { restoredPackage: packageFileName };
    } catch (error) {
      if (error instanceof BusinessError) throw error;
      await this.appendRestoreHistory({
        at: new Date().toISOString(),
        packageName: packageFileName,
        result: "failed",
        performedBy: context.user?.email ?? context.userId,
      }).catch(() => {});
      throw error;
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
  }

  /**
   * Verifies a backup package without restoring it: validates the manifest,
   * confirms the database dump is readable, and checks the uploads archive
   * integrity. Used after creation so a corrupt backup fails loudly at
   * creation time rather than at restore time.
   */
  async verifyPackage(packageFileName: string) {
    const packagePath = join(this.packagesDir, basename(packageFileName));
    if (!existsSync(packagePath)) {
      throw new BusinessError("Backup package was not found.", "BACKUP_PACKAGE_NOT_FOUND");
    }
    await this.assertToolsAvailable(["pg_restore", "tar"]);

    const staging = await mkdtemp(join(tmpdir(), "wbos-verify-"));
    try {
      const { packageDir, manifest } = await this.extractPackage(staging, packagePath);

      const checks: Record<string, unknown> = {};

      const dumpFile = join(packageDir, manifest.database.file);
      if (!existsSync(dumpFile)) {
        throw new BusinessError("Database dump is missing from the package.", "BACKUP_VERIFY_DUMP_MISSING");
      }
      try {
        const listing = await this.run("pg_restore", ["--list", dumpFile]);
        const entries = listing.stdout.split("\n").filter((l) => l.trim() && !l.trim().startsWith(";")).length;
        checks.databaseDumpReadable = true;
        checks.databaseObjects = entries;
      } catch (error) {
        throw new BusinessError(
          `Database dump could not be read (pg_restore --list failed): ${error instanceof Error ? error.message : String(error)}`,
          "BACKUP_VERIFY_DUMP_UNREADABLE",
        );
      }

      if (manifest.uploads) {
        const uploadsFile = join(packageDir, manifest.uploads.file);
        if (!existsSync(uploadsFile)) {
          throw new BusinessError("Uploads archive is missing from the package.", "BACKUP_VERIFY_UPLOADS_MISSING");
        }
        try {
          const listing = await this.run("tar", ["tzf", uploadsFile]);
          const files = listing.stdout.split("\n").filter(Boolean);
          checks.uploadsArchiveReadable = true;
          checks.uploadsFiles = files.length;
        } catch (error) {
          throw new BusinessError(
            `Uploads archive could not be read: ${error instanceof Error ? error.message : String(error)}`,
            "BACKUP_VERIFY_UPLOADS_UNREADABLE",
          );
        }
      } else {
        checks.uploads = "not included";
      }

      checks.manifest = "valid";
      checks.formatVersion = manifest.formatVersion;
      checks.appVersion = manifest.appVersion;

      return { fileName: packageFileName, ok: true as const, checks };
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
  }

  private async extractPackage(stagingDir: string, packagePath: string) {
    await this.run("tar", ["xzf", packagePath, "-C", stagingDir]);
    const entries = await readdir(stagingDir);
    const packageName = entries.find((e) => e.startsWith(BACKUP_PACKAGE_PREFIX));
    if (!packageName) {
      throw new BusinessError("Backup package contents are invalid.", "BACKUP_PACKAGE_INVALID");
    }
    const packageDir = join(stagingDir, packageName);
    const manifest = await this.readManifest(packageDir);
    return { packageDir, manifest };
  }

  private async listAppliedMigrations(): Promise<string[]> {
    if (!existsSync(this.migrationDir)) {
      return [];
    }
    const entries = await readdir(this.migrationDir);
    return entries
      .filter((e) => !e.startsWith(".") && !e.endsWith(".toml") && !e.includes("."))
      .sort();
  }

  private async appendRestoreHistory(entry: RestoreHistoryEntry) {
    await mkdir(this.backupRoot, { recursive: true });
    const previous = existsSync(this.restoreHistoryFile)
      ? await readFile(this.restoreHistoryFile, "utf8")
      : "";
    await writeFile(this.restoreHistoryFile, `${previous}${previous ? "\n" : ""}${JSON.stringify(entry)}`, "utf8");
  }
}
