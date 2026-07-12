#!/usr/bin/env node

/**
 * WBOS Startup Validation
 *
 * Runs on container start to verify the environment is healthy.
 * Fails fast with meaningful messages if something is wrong.
 */

const REQUIRED_ENV_VARS = ["DATABASE_URL", "BETTER_AUTH_SECRET"];
const RECOMMENDED_ENV_VARS = ["BETTER_AUTH_URL", "WBOS_STORAGE_ROOT"];

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

  // ── Summary ──
  console.log("");
  if (exitCode === 0) {
    console.log("✓ All checks passed. WBOS is ready.\n");
  } else {
    console.log(`✗ ${exitCode} check(s) failed. Review messages above.\n`);
  }

  process.exit(exitCode);
})();
