import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { isManifestCompatible, manifestSchema } from "@/domains/backups/backup-format";
import { BackupService, parseDatabaseUrl } from "@/domains/backups/services/backup-service";
import { BusinessError } from "@/shared/errors/business-error";

const realTar = promisify(execFile);

const MIGRATIONS = ["20260101000001_init", "20260201000002_add_inventory", "20260301000003_add_import_shipments"];

function makeManifest(overrides = {}) {
  return {
    formatVersion: 1,
    appVersion: "0.1.0",
    createdAt: "2026-08-05T10:00:00.000Z",
    createdBy: "owner@example.com",
    database: { file: "database.dump", bytes: 100, migrations: MIGRATIONS },
    uploads: { file: "uploads.tar.gz", bytes: 50 },
    config: { file: "config.json" },
    ...overrides,
  };
}

function makeContext() {
  return {
    organizationId: "org-1",
    userId: "user-1",
    role: "OWNER",
    user: { email: "owner@example.com" },
  } as never;
}

describe("backup-format", () => {
  it("accepts manifest with matching or older format", () => {
    expect(isManifestCompatible(makeManifest(), MIGRATIONS)).toEqual({ ok: true });
    expect(isManifestCompatible(makeManifest({ formatVersion: 1 }), MIGRATIONS)).toEqual({ ok: true });
  });

  it("rejects manifest from a newer format version", () => {
    const result = isManifestCompatible(makeManifest({ formatVersion: 99 }), MIGRATIONS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("newer WBOS format");
    }
  });

  it("rejects backup containing unknown future migrations", () => {
    const result = isManifestCompatible(
      makeManifest({ database: { file: "database.dump", bytes: 100, migrations: [...MIGRATIONS, "20260901000004_future"] } }),
      MIGRATIONS,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("newer WBOS schema");
    }
  });

  it("accepts backup with a subset of migrations (older app)", () => {
    expect(isManifestCompatible(makeManifest({ database: { file: "database.dump", bytes: 100, migrations: [MIGRATIONS[0]] } }), MIGRATIONS)).toEqual({ ok: true });
  });

  it("validates manifest schema", () => {
    expect(manifestSchema.safeParse(makeManifest()).success).toBe(true);
    expect(manifestSchema.safeParse(makeManifest({ formatVersion: "nope" })).success).toBe(false);
    expect(manifestSchema.safeParse(makeManifest({ database: {} })).success).toBe(false);
  });
});

describe("parseDatabaseUrl", () => {
  it("parses host, port, user, database and password from a Prisma URL", () => {
    const conn = parseDatabaseUrl("postgresql://wbos:s3cr%40t@db.example.com:5433/wbos?schema=public");
    expect(conn).toEqual({
      host: "db.example.com",
      port: 5433,
      user: "wbos",
      database: "wbos",
      password: "s3cr@t",
    });
  });

  it("defaults the port to 5432 and ignores Prisma query parameters", () => {
    const conn = parseDatabaseUrl("postgresql://user:pass@192.168.100.36/wbos?schema=public&pgbouncer=true");
    expect(conn.port).toBe(5432);
    expect(conn.host).toBe("192.168.100.36");
    expect(conn.database).toBe("wbos");
  });

  it("throws on a URL without a host", () => {
    expect(() => parseDatabaseUrl("not-a-url")).toThrow(BusinessError);
  });
});

describe("BackupService", () => {
  let backupRoot: string;
  let storageRoot: string;
  let migrationDir: string;
  let runMock: ReturnType<typeof vi.fn>;
  let service: BackupService;

  beforeEach(async () => {
    const base = await mkdtemp(join(tmpdir(), "wbos-test-"));
    backupRoot = join(base, "backups");
    storageRoot = join(base, "storage");
    migrationDir = join(base, "migrations");
    await mkdir(migrationDir, { recursive: true });
    for (const m of MIGRATIONS) {
      await mkdir(join(migrationDir, m), { recursive: true });
    }
    await mkdir(join(storageRoot, "uploads"), { recursive: true });
    await writeFile(join(storageRoot, "uploads", "file.txt"), "hello");

    runMock = vi.fn(async (cmd: string, args: string[]) => {
      if (cmd === "pg_dump") {
        if (args.includes("--version")) return { stdout: "pg_dump 16", stderr: "" };
        const dumpPath = args[args.indexOf("-f") + 1];
        await mkdir(join(dumpPath, ".."), { recursive: true });
        await writeFile(dumpPath, "PGDUMP");
        return { stdout: "", stderr: "" };
      }
      if (cmd === "pg_restore") {
        if (args.includes("--version")) return { stdout: "pg_restore 16", stderr: "" };
        await writeFile(join(args[args.length - 1]), "RESTORED");
        return { stdout: "", stderr: "" };
      }
      if (cmd === "tar") {
        if (args.includes("--version")) return { stdout: "tar 3.1", stderr: "" };
        return realTar("tar", args);
      }
      return { stdout: "", stderr: "" };
    });
    service = new BackupService(
      backupRoot,
      storageRoot,
      "postgresql://user:pass@db:5432/wbos?schema=public",
      migrationDir,
      runMock as unknown as (file: string, args: readonly string[], options?: { env?: NodeJS.ProcessEnv }) => Promise<{ stdout: string; stderr: string }>,
    );
  });

  afterEach(async () => {
    await rm(join(backupRoot, ".."), { recursive: true, force: true });
  });

  it("creates a single timestamped tar.gz package and returns its metadata", async () => {
    const result = await service.createBackup(makeContext());

    expect(result.fileName).toMatch(/^wbos-backup-\d{8}_\d{6}\.tar\.gz$/);
    expect(result.bytes).toBeGreaterThan(0);
    expect(result.manifest.formatVersion).toBe(1);
    expect(result.manifest.database.migrations).toEqual(MIGRATIONS);
    expect(result.manifest.createdBy).toBe("owner@example.com");
  });

  it("invokes pg_dump and tar for the uploads archive", async () => {
    await service.createBackup(makeContext());

    const pgDumpCall = runMock.mock.calls.find(([cmd, args]) => cmd === "pg_dump" && !args.includes("--version"));
    expect(pgDumpCall).toBeDefined();
    expect(pgDumpCall![1]).toContain("-Fc");

    const tarCalls = runMock.mock.calls.filter(([cmd, args]) => cmd === "tar" && !args.includes("--version"));
    expect(tarCalls.length).toBeGreaterThanOrEqual(1);
    expect(tarCalls[0][1]).toContain("czf");
  });

  it("does not pass Prisma-only query parameters (schema) to pg_dump", async () => {
    await service.createBackup(makeContext());

    const pgDumpCall = runMock.mock.calls.find(([cmd, args]) => cmd === "pg_dump" && !args.includes("--version"));
    expect(pgDumpCall).toBeDefined();
    expect(pgDumpCall![1].join(" ")).not.toContain("?schema=public");
    expect(pgDumpCall![1].join(" ")).not.toMatch(/\.\.\?/);
  });

  it("passes connection details via -h/-p/-U/-d and the password via PGPASSWORD", async () => {
    await service.createBackup(makeContext());

    const pgDumpCall = runMock.mock.calls.find(([cmd, args]) => cmd === "pg_dump" && !args.includes("--version"));
    expect(pgDumpCall![1]).toContain("-h");
    expect(pgDumpCall![1]).toContain("db");
    expect(pgDumpCall![1]).toContain("-p");
    expect(pgDumpCall![1]).toContain("5432");
    expect(pgDumpCall![1]).toContain("-U");
    expect(pgDumpCall![1]).toContain("user");
    expect(pgDumpCall![1]).toContain("-d");
    expect(pgDumpCall![1]).toContain("wbos");
    expect((pgDumpCall![2] as { env?: NodeJS.ProcessEnv }).env?.PGPASSWORD).toBe("pass");
    expect(pgDumpCall![1].join(" ")).not.toContain("pass");
  });

  it("uses the same connection handling for pg_restore", async () => {
    await service.createBackup(makeContext());
    const [pkg] = await service.listBackups();
    await service.restoreBackup(makeContext(), pkg.fileName, "RESTORE");

    const pgRestoreCall = runMock.mock.calls.find(([cmd, args]) => cmd === "pg_restore" && !args.includes("--version") && !args.includes("--list"));
    expect(pgRestoreCall).toBeDefined();
    expect(pgRestoreCall![1].join(" ")).not.toContain("?schema=public");
    expect(pgRestoreCall![1]).toContain("-h");
    expect(pgRestoreCall![1]).toContain("-d");
    expect((pgRestoreCall![2] as { env?: NodeJS.ProcessEnv }).env?.PGPASSWORD).toBe("pass");
  });

  it("lists backups newest first", async () => {
    await service.createBackup(makeContext());
    const backups = await service.listBackups();
    expect(backups.length).toBe(1);
    expect(backups[0].fileName).toMatch(/^wbos-backup-/);
    expect(backups[0].bytes).toBeGreaterThan(0);
  });

  it("reports status with last backup and no restore test", async () => {
    await service.createBackup(makeContext());
    const status = await service.getStatus();
    expect(status.lastBackupAt).not.toBeNull();
    expect(status.lastRestoreTest).toBeNull();
  });

  it("requires exact RESTORE confirmation before restoring", async () => {
    const backups = await service.listBackups();
    expect(backups.length).toBe(0);

    await service.createBackup(makeContext());
    const [pkg] = await service.listBackups();

    await expect(service.restoreBackup(makeContext(), pkg.fileName, "restore")).rejects.toBeInstanceOf(BusinessError);
  });

  it("restores a package and records a successful restore test", async () => {
    await service.createBackup(makeContext());
    const [pkg] = await service.listBackups();

    await service.restoreBackup(makeContext(), pkg.fileName, "RESTORE");

    const pgRestore = runMock.mock.calls.find(([cmd, args]) => cmd === "pg_restore" && !args.includes("--version") && !args.includes("--list"));
    expect(pgRestore).toBeDefined();
    expect(pgRestore![1]).toContain("--clean");

    const status = await service.getStatus();
    expect(status.lastRestoreTest).not.toBeNull();
    expect(status.lastRestoreTest!.packageName).toBe(pkg.fileName);
    expect(status.lastRestoreTest!.result).toBe("success");
  });

  it("reports a FAILED restore test instead of an older successful one", async () => {
    // A shell-side restore test (scripts/restore-test.sh) appends JSONL records
    // for failures too. Surfacing the last *success* here would keep the Last
    // Restore Test indicator showing PASS while the restore path is broken —
    // the exact blind spot this indicator exists to close.
    await mkdir(backupRoot, { recursive: true });
    await writeFile(
      join(backupRoot, "restore-history.json"),
      [
        JSON.stringify({
          at: "2026-08-10T02:00:00.000Z",
          packageName: "wbos-backup-old.tar.gz",
          result: "success",
          performedBy: "restore-test.sh",
        }),
        JSON.stringify({
          at: "2026-08-16T02:00:00.000Z",
          packageName: "wbos-backup-new.tar.gz",
          result: "failed",
          performedBy: "restore-test.sh",
          reason: "pg_restore failed while restoring the dump into the scratch database",
        }),
      ].join("\n"),
      "utf8",
    );

    const status = await service.getStatus();
    expect(status.lastRestoreTest).not.toBeNull();
    expect(status.lastRestoreTest!.result).toBe("failed");
    expect(status.lastRestoreTest!.packageName).toBe("wbos-backup-new.tar.gz");
    expect(status.lastRestoreTest!.reason).toContain("pg_restore failed");
  });

  it("ignores malformed history lines when resolving the latest restore test", async () => {
    await mkdir(backupRoot, { recursive: true });
    await writeFile(
      join(backupRoot, "restore-history.json"),
      [
        JSON.stringify({
          at: "2026-08-16T02:00:00.000Z",
          packageName: "wbos-backup-good.tar.gz",
          result: "success",
          performedBy: "restore-test.sh",
        }),
        "{ not json",
      ].join("\n"),
      "utf8",
    );

    const status = await service.getStatus();
    expect(status.lastRestoreTest!.packageName).toBe("wbos-backup-good.tar.gz");
    expect(status.lastRestoreTest!.result).toBe("success");
  });

  it("rejects restore of an unknown package", async () => {
    await expect(service.restoreBackup(makeContext(), "wbos-backup-doesnotexist.tar.gz", "RESTORE")).rejects.toBeInstanceOf(BusinessError);
  });

  it("verifies a package: manifest, dump readability, uploads archive", async () => {
    await service.createBackup(makeContext());
    const [pkg] = await service.listBackups();

    const result = await service.verifyPackage(pkg.fileName);
    expect(result.ok).toBe(true);
    expect(result.checks.databaseDumpReadable).toBe(true);
    expect(result.checks.uploadsArchiveReadable).toBe(true);
    expect(result.checks.manifest).toBe("valid");
  });

  it("deletes a corrupt package at creation time when verification fails", async () => {
    runMock.mockImplementation(async (cmd: string, args: string[]) => {
      if (cmd === "pg_dump") {
        if (args.includes("--version")) return { stdout: "pg_dump 16", stderr: "" };
        const dumpPath = args[args.indexOf("-f") + 1];
        await mkdir(join(dumpPath, ".."), { recursive: true });
        await writeFile(dumpPath, "PGDUMP");
        return { stdout: "", stderr: "" };
      }
      if (cmd === "pg_restore") {
        if (args.includes("--version")) return { stdout: "pg_restore 16", stderr: "" };
        if (args.includes("--list")) throw new Error("could not read dump");
        return { stdout: "", stderr: "" };
      }
      if (cmd === "tar") {
        if (args.includes("--version")) return { stdout: "tar 3.1", stderr: "" };
        return realTar("tar", args);
      }
      return { stdout: "", stderr: "" };
    });

    await expect(service.createBackup(makeContext())).rejects.toThrow(/could not be read/);
    expect(await service.listBackups()).toHaveLength(0);
  });

  it("restores uploads into the correct storage location", async () => {
    await service.createBackup(makeContext());
    const [pkg] = await service.listBackups();

    await rm(join(storageRoot, "uploads", "file.txt"));
    expect(existsSync(join(storageRoot, "uploads", "file.txt"))).toBe(false);

    await service.restoreBackup(makeContext(), pkg.fileName, "RESTORE");

    expect(existsSync(join(storageRoot, "uploads", "file.txt"))).toBe(true);
    expect(existsSync(join(storageRoot, "storage", "uploads", "file.txt"))).toBe(false);
  });

  it("fails when DATABASE_URL is missing", async () => {
    const noDbService = new BackupService(
      backupRoot,
      storageRoot,
      undefined,
      migrationDir,
      runMock as unknown as (file: string, args: readonly string[], options?: { env?: NodeJS.ProcessEnv }) => Promise<{ stdout: string; stderr: string }>,
    );
    await expect(noDbService.createBackup(makeContext())).rejects.toBeInstanceOf(BusinessError);
  });

  it("returns a friendly error when pg_dump is missing from PATH", async () => {
    runMock.mockImplementation(async (cmd: string) => {
      if (cmd === "pg_dump") {
        const error = new Error("spawn pg_dump ENOENT") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      }
      if (cmd === "tar") return { stdout: "tar 3.1", stderr: "" };
      return { stdout: "", stderr: "" };
    });

    await expect(service.createBackup(makeContext())).rejects.toThrow(/pg_dump.*not found in PATH/);
  });

  it("returns a friendly error when tar is missing from PATH", async () => {
    runMock.mockImplementation(async (cmd: string) => {
      if (cmd === "tar") {
        const error = new Error("spawn tar ENOENT") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      }
      if (cmd === "pg_dump") return { stdout: "pg_dump 16", stderr: "" };
      return { stdout: "", stderr: "" };
    });

    await expect(service.createBackup(makeContext())).rejects.toThrow(/tar.*not found in PATH/);
  });

  it("returns a friendly error when pg_restore is missing before restoring", async () => {
    await service.createBackup(makeContext());
    const [pkg] = await service.listBackups();

    runMock.mockImplementation(async (cmd: string, args: string[]) => {
      if (cmd === "pg_restore") {
        const error = new Error("spawn pg_restore ENOENT") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      }
      if (cmd === "tar") {
        if (args.includes("--version")) return { stdout: "tar 3.1", stderr: "" };
        return realTar("tar", args);
      }
      if (cmd === "pg_dump") {
        if (args.includes("--version")) return { stdout: "pg_dump 16", stderr: "" };
        return { stdout: "", stderr: "" };
      }
      return { stdout: "", stderr: "" };
    });

    await expect(service.restoreBackup(makeContext(), pkg.fileName, "RESTORE")).rejects.toThrow(/pg_restore.*not found in PATH/);
  });

  it("checkTools reports each tool with ok status", async () => {
    const checks = await service.checkTools(["pg_dump", "tar"]);
    expect(checks).toHaveLength(2);
    expect(checks[0]).toMatchObject({ tool: "pg_dump", ok: true });
    expect(checks[0].version).toContain("pg_dump");
    expect(checks[1]).toMatchObject({ tool: "tar", ok: true });
  });

  it("checkTools marks missing tools as not ok with an error", async () => {
    runMock.mockImplementation(async (cmd: string) => {
      if (cmd === "pg_restore") {
        const error = new Error("spawn pg_restore ENOENT") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      }
      return { stdout: "ok", stderr: "" };
    });

    const checks = await service.checkTools(["pg_restore"]);
    expect(checks[0].ok).toBe(false);
    expect(checks[0].error).toContain("not found in PATH");
  });

  it("getDiagnostics returns PATH and all three tool checks", async () => {
    const diagnostics = await service.getDiagnostics();
    expect(typeof diagnostics.path).toBe("string");
    expect(diagnostics.tools.map((t) => t.tool)).toEqual(["pg_dump", "pg_restore", "tar"]);
    expect(diagnostics.tools.every((t) => t.ok)).toBe(true);
  });

  it("records failed restore test on pg_restore error", async () => {
    await service.createBackup(makeContext());
    const [pkg] = await service.listBackups();

    runMock.mockImplementation(async (cmd: string, args: string[]) => {
      if (cmd === "pg_restore") {
        if (args.includes("--version")) return { stdout: "pg_restore 16", stderr: "" };
        throw new Error("connection failed");
      }
      if (cmd === "pg_dump") {
        if (args.includes("--version")) return { stdout: "pg_dump 16", stderr: "" };
        const dumpPath = args[4];
        await mkdir(join(dumpPath, ".."), { recursive: true });
        await writeFile(dumpPath, "PGDUMP");
      }
      if (cmd === "tar") {
        if (args.includes("--version")) return { stdout: "tar 3.1", stderr: "" };
        return realTar("tar", args);
      }
    });

    await expect(service.restoreBackup(makeContext(), pkg.fileName, "RESTORE")).rejects.toThrow("connection failed");

    // The failure is recorded AND surfaced. This previously asserted null,
    // which meant a failed restore left the last successful run showing as the
    // Last Restore Test indicator — reporting PASS while restore was broken.
    const status = await service.getStatus();
    expect(status.lastRestoreTest).not.toBeNull();
    expect(status.lastRestoreTest!.result).toBe("failed");
    expect(status.lastRestoreTest!.packageName).toBe(pkg.fileName);
  });

  it("staging directory is cleaned up after create", async () => {
    await service.createBackup(makeContext());
    expect(existsSync(join(backupRoot, "packages"))).toBe(true);
    const osTmp = tmpdir();
    const leftovers = readdirSync(osTmp)
      .filter((f) => f.startsWith("wbos-backup-"));
    expect(leftovers).toEqual([]);
  });
});
