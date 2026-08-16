#!/usr/bin/env node

/**
 * WBOS Startup Validation
 *
 * Runs on container start to verify the environment is healthy.
 * Fails fast with meaningful messages if something is wrong.
 */

const REQUIRED_ENV_VARS = ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL"];
const RECOMMENDED_ENV_VARS = ["WBOS_STORAGE_ROOT", "WBOS_BACKUP_DIR"];
const BACKUP_TOOLS = ["pg_dump", "pg_restore", "tar"];

let exitCode = 0;

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

function warn(msg) {
  console.log(`  ⚠ ${msg}`);
}

function fail(msg) {
  console.log(`  ✗ ${msg}`);
  exitCode = 1;
}

console.log("\nWBOS Startup Validation\n");

// ── Environment Variables ──
console.log("1. Environment Variables");

for (const key of REQUIRED_ENV_VARS) {
  if (process.env[key]) {
    ok(`${key} is set`);
  } else {
    fail(`${key} is MISSING`);
  }
}

for (const key of RECOMMENDED_ENV_VARS) {
  if (process.env[key]) {
    ok(`${key} is set`);
  } else {
    warn(`${key} is not set (optional)`);
  }
}

// ── Database ──
console.log("\n2. Database Connection");

(async () => {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    ok("PostgreSQL connection successful");
    await prisma.$disconnect();
  } catch (err) {
    fail(`PostgreSQL connection FAILED: ${err.message}`);
  }

  // ── Prisma Migrations ──
  console.log("\n3. Prisma Migrations");

  try {
    const { execSync } = await import("child_process");
    const output = execSync("npx prisma migrate status", {
      encoding: "utf-8",
      env: { ...process.env, NODE_ENV: "production" },
    });
    if (output.includes("All migrations have been successfully applied")) {
      ok("All migrations applied");
    } else {
      warn("Migrations may be pending — run `npx prisma migrate deploy`");
      console.log(`  Output: ${output.split("\n").slice(0, 3).join("\n  ")}`);
    }
  } catch (err) {
    warn(`Could not check migration status: ${err.message}`);
  }

  // ── Playwright ──
  console.log("\n4. Playwright / PDF Generation");

  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    await browser.close();
    ok("Playwright Chromium is available");
  } catch (err) {
    fail(`Playwright check FAILED: ${err.message}`);
  }

  // ── Upload Directory ──
  console.log("\n5. Upload Directory");

  const storageRoot = process.env.WBOS_STORAGE_ROOT || "./storage";
  try {
    const { existsSync, mkdirSync } = await import("fs");
    if (existsSync(storageRoot)) {
      ok(`Upload directory exists: ${storageRoot}`);
    } else {
      mkdirSync(storageRoot, { recursive: true });
      ok(`Upload directory created: ${storageRoot}`);
    }
  } catch (err) {
    fail(`Upload directory check FAILED: ${err.message}`);
  }

  // ── Backup Tools ──
  console.log("\n6. Backup Tools");

  const { spawnSync } = await import("child_process");
  let pgDumpMajor = null;
  for (const tool of BACKUP_TOOLS) {
    const probe = spawnSync(tool, ["--version"], { encoding: "utf-8" });
    if (probe.status === 0) {
      const versionLine = (probe.stdout || "").trim().split("\n")[0];
      ok(`${tool} available (${versionLine})`);
      if (tool === "pg_dump") {
        // "pg_dump (PostgreSQL) 17.2 (Debian 17.2-1.pgdg120+1)" -> 17
        const m = versionLine.match(/\)\s*(\d+)/) || versionLine.match(/(\d+)\.\d+/);
        if (m) pgDumpMajor = Number(m[1]);
      }
    } else {
      fail(`${tool} is NOT available in PATH`);
    }
  }

  // ── PostgreSQL client/server major version match ──
  // A dump taken by pg_dump N cannot be reliably restored into a server older
  // than N, and pg_dump refuses to dump from a server newer than itself. A
  // silent mismatch means backups look fine and only fail at restore time —
  // exactly the failure the DR work exists to prevent.
  console.log("\n6b. PostgreSQL Version Match");
  if (pgDumpMajor === null) {
    warn("Could not determine pg_dump major version — skipping client/server check");
  } else {
    try {
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      const rows = await prisma.$queryRaw`SHOW server_version`;
      await prisma.$disconnect();
      const serverVersion = String(rows?.[0]?.server_version ?? "");
      const serverMajor = Number(serverVersion.split(".")[0]);
      if (!Number.isFinite(serverMajor)) {
        warn(`Could not parse server_version ("${serverVersion}") — skipping check`);
      } else if (serverMajor === pgDumpMajor) {
        ok(`pg_dump ${pgDumpMajor} matches PostgreSQL server ${serverMajor}`);
      } else if (pgDumpMajor > serverMajor) {
        // Deliberately a warning, not a failure: the mismatch threatens RESTORE,
        // not runtime correctness. Refusing to boot would turn a latent DR risk
        // into an immediate outage — possibly during the emergency deploy that
        // is trying to fix it.
        warn(
          `pg_dump is ${pgDumpMajor} but the server is ${serverMajor}. Dumps taken here ` +
            `may NOT restore into this server. Align the postgres image major with the ` +
            `client in the app image (see docs/PRODUCTION_DEPLOYMENT.md §11).`,
        );
      } else {
        warn(
          `pg_dump is ${pgDumpMajor} but the server is ${serverMajor}. Upgrade the client ` +
            `tools in the app image to match the server.`,
        );
      }
    } catch (err) {
      warn(`Could not check PostgreSQL server version: ${err.message}`);
    }
  }

  // ── Disk Space ──
  console.log("\n7. Disk Space");
  try {
    const { statfsSync } = await import("fs");
    for (const dir of [storageRoot, process.env.WBOS_BACKUP_DIR || "./backups"]) {
      const s = statfsSync(dir);
      const percent = s.bavail && s.blocks ? Math.round((s.bavail / s.blocks) * 100) : null;
      const freeGb = (s.bavail * s.bsize) / 1024 / 1024 / 1024;
      if (percent !== null && percent < 10) {
        fail(`${dir}: only ${freeGb.toFixed(1)} GB free (${percent}%)`);
      } else {
        ok(`${dir}: ${freeGb.toFixed(1)} GB free${percent !== null ? ` (${percent}%)` : ""}`);
      }
    }
  } catch (err) {
    warn(`Disk space check skipped: ${err.message}`);
  }

  // ── Summary ──
  console.log("");
  if (exitCode === 0) {
    console.log("✓ All checks passed. WBOS is ready.\n");
  } else {
    console.log(`✗ ${exitCode} check(s) failed. Review messages above.\n`);
  }

  process.exit(exitCode);
})();
