"use client";

import { Archive, CheckCircle2, Download, FileWarning, HardDrive, RefreshCw, ShieldAlert, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { createBackupAction } from "@/domains/backups/actions/create-backup";
import { getBackupDiagnosticsAction } from "@/domains/backups/actions/get-backup-diagnostics";
import { restoreBackupAction } from "@/domains/backups/actions/restore-backup";
import type { BackupPackageMeta, BackupStatus, ToolCheck } from "@/domains/backups/services/backup-service";

type BackupPanelProps = {
  backups: BackupPackageMeta[];
  lastBackupAt: string | null;
  lastRestoreTest: BackupStatus["lastRestoreTest"];
  canRestore: boolean;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function ToolStatus({ checks }: { checks: ToolCheck[] | null }) {
  if (!checks) {
    return <p className="text-xs text-muted-foreground">Checking…</p>;
  }
  return (
    <ul className="space-y-1">
      {checks.map((c) => (
        <li key={c.tool} className="flex items-center gap-2 text-sm">
          {c.ok ? (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          ) : (
            <XCircle className="size-4 shrink-0 text-destructive" />
          )}
          <span className="font-mono text-xs">{c.tool}</span>
          <span className="text-xs text-muted-foreground">{c.ok ? (c.version ?? "available") : (c.error ?? "unavailable")}</span>
        </li>
      ))}
    </ul>
  );
}

export function BackupPanel({ backups, lastBackupAt, lastRestoreTest, canRestore }: BackupPanelProps) {
  const router = useRouter();
  const [isCreating, startCreate] = useTransition();
  const [restoreTarget, setRestoreTarget] = useState<string>("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRestoring, startRestore] = useTransition();
  const [toolChecks, setToolChecks] = useState<ToolCheck[] | null>(null);

  useEffect(() => {
    let active = true;
    getBackupDiagnosticsAction().then((result) => {
      if (active && result.ok) setToolChecks(result.diagnostics.tools);
    });
    return () => {
      active = false;
    };
  }, []);

  function handleCreate() {
    setMessage(null);
    setError(null);
    startCreate(async () => {
      const result = await createBackupAction();
      if (!result.ok) {
        setError(result.message ?? "Backup failed.");
        return;
      }
      setMessage(`Backup created: ${result.backup.fileName}`);
      router.refresh();
    });
  }

  function handleRestore() {
    setMessage(null);
    setError(null);
    startRestore(async () => {
      const result = await restoreBackupAction({ fileName: restoreTarget, confirmation });
      if (!result.ok) {
        setError(result.message ?? "Restore failed.");
        return;
      }
      setMessage(`Restored ${result.restored}.`);
      setRestoreTarget("");
      setConfirmation("");
      router.refresh();
    });
  }

  return (
    <div className="max-w-3xl space-y-8">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Verification status</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <HardDrive className="size-4 text-muted-foreground" />
              Last Backup
            </div>
            <p className="mt-2 text-lg font-semibold">
              {lastBackupAt ? formatDate(lastBackupAt) : "Never"}
            </p>
            <p className="text-xs text-muted-foreground">
              {backups.length} package{backups.length === 1 ? "" : "s"} stored.
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="size-4 text-muted-foreground" />
              Last Restore Test
            </div>
            <p className="mt-2 text-lg font-semibold">
              {lastRestoreTest ? formatDate(lastRestoreTest.at) : "Never"}
            </p>
            {lastRestoreTest ? (
              <p className="text-xs text-muted-foreground">{lastRestoreTest.packageName} — Successful</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                A backup that has never been restored is only a theory.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Backup tools</h2>
        <div className="rounded-lg border p-4">
          <ToolStatus checks={toolChecks} />
          <p className="mt-2 text-xs text-muted-foreground">
            WBOS shells out to these tools to create and restore backups. If any are missing, the page shows which one.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Create a backup</h2>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            <Archive className="size-4" />
            {isCreating ? "Creating…" : "Create Backup Now"}
          </button>
          <p className="text-xs text-muted-foreground">
            Produces a single <code className="rounded bg-muted px-1">wbos-backup-&lt;timestamp&gt;.tar.gz</code> containing the database dump and uploads archive.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Backup packages</h2>
        {backups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No backup packages found yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Package</th>
                  <th className="px-4 py-2 font-medium">Created</th>
                  <th className="px-4 py-2 font-medium">Size</th>
                  <th className="px-4 py-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {backups.map((b) => (
                  <tr key={b.fileName} className="text-muted-foreground">
                    <td className="px-4 py-2 font-mono text-xs text-foreground">{b.fileName}</td>
                    <td className="px-4 py-2 text-xs">{formatDate(b.createdAt)}</td>
                    <td className="px-4 py-2 text-xs">{formatBytes(b.bytes)}</td>
                    <td className="px-4 py-2 text-right">
                      <a
                        href={`/api/backups/download/${encodeURIComponent(b.fileName)}`}
                        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition hover:bg-muted"
                      >
                        <Download className="size-3.5" />
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert className="size-4 text-amber-600" />
          Restore a backup
        </h2>
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm">
            Restoring overwrites the current database and uploads with the contents of the package.
            This action is destructive and cannot be undone.
          </p>
          {!canRestore ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Only the organization OWNER can restore a backup.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2">
                <FileWarning className="size-4 text-destructive" />
                <select
                  value={restoreTarget}
                  onChange={(e) => setRestoreTarget(e.target.value)}
                  className="h-10 w-full max-w-sm rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary"
                >
                  <option value="">Select a package…</option>
                  {backups.map((b) => (
                    <option key={b.fileName} value={b.fileName}>
                      {b.fileName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Type</span>
                <input
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder="RESTORE"
                  className="h-10 w-40 rounded-md border bg-background px-3 font-mono text-sm uppercase outline-none transition focus:border-primary"
                />
              </div>
              <button
                onClick={handleRestore}
                disabled={isRestoring || restoreTarget === "" || confirmation !== "RESTORE"}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                <RefreshCw className="size-4" />
                {isRestoring ? "Restoring…" : "Restore"}
              </button>
            </div>
          )}
        </div>
      </section>

      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
