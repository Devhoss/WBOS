#!/usr/bin/env node

/**
 * WBOS SMTP Check
 *
 * Verifies the SMTP configuration and, optionally, sends a real test message —
 * so password recovery is proven to work BEFORE somebody is locked out.
 *
 * Usage:
 *   node scripts/smtp-check.mjs                 # connect + authenticate only
 *   node scripts/smtp-check.mjs you@example.com # also send a test email
 *
 * Inside the deployed stack:
 *   docker compose -f docker-compose.prod.yml exec -T app \
 *     node scripts/smtp-check.mjs you@example.com
 *
 * Exit codes: 0 = OK · 1 = misconfigured or delivery failed · 2 = disabled
 */

import nodemailer from "nodemailer";

const trimmed = (name) => (process.env[name] ?? "").trim();
const flag = (name, fallback) => {
  const raw = trimmed(name).toLowerCase();
  if (raw === "") return fallback;
  return !["0", "false", "no", "off"].includes(raw);
};

const host = trimmed("WBOS_SMTP_HOST");
if (host === "") {
  console.log("SMTP is not configured (WBOS_SMTP_HOST is unset).");
  console.log("Password recovery is disabled; the forgot-password page says so.");
  process.exit(2);
}

const portRaw = trimmed("WBOS_SMTP_PORT") || "587";
const port = Number(portRaw);
const from = trimmed("WBOS_SMTP_FROM");
const user = trimmed("WBOS_SMTP_USER");
const pass = process.env.WBOS_SMTP_PASSWORD ?? "";

const problems = [];
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  problems.push(`WBOS_SMTP_PORT is invalid: "${portRaw}"`);
}
if (from === "") problems.push("WBOS_SMTP_FROM is not set");
if (user !== "" && pass === "") problems.push("WBOS_SMTP_USER is set but WBOS_SMTP_PASSWORD is not");
if (user === "" && pass !== "") problems.push("WBOS_SMTP_PASSWORD is set but WBOS_SMTP_USER is not");

if (problems.length > 0) {
  console.error("SMTP configuration is incomplete:");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

const secure = flag("WBOS_SMTP_SECURE", port === 465);
const rejectUnauthorized = flag("WBOS_SMTP_REJECT_UNAUTHORIZED", true);

// Never print the password.
console.log("SMTP configuration:");
console.log(`  host:   ${host}:${port}`);
console.log(`  secure: ${secure ? "implicit TLS" : "STARTTLS"} (verify cert: ${rejectUnauthorized})`);
console.log(`  auth:   ${user ? user : "(none)"}`);
console.log(`  from:   ${from}`);
console.log("");

const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: user ? { user, pass } : undefined,
  tls: { rejectUnauthorized },
});

try {
  await transporter.verify();
  console.log("  OK  connected and authenticated");
} catch (error) {
  console.error(`  FAILED  ${error.message}`);
  process.exit(1);
}

const recipient = process.argv[2];
if (!recipient) {
  console.log("");
  console.log("Pass an address to also send a test message:");
  console.log("  node scripts/smtp-check.mjs you@example.com");
  process.exit(0);
}

try {
  const info = await transporter.sendMail({
    from,
    to: recipient,
    subject: "WBOS SMTP test",
    text:
      "This is a WBOS SMTP test message.\n\n" +
      "If you received it, password recovery emails will be delivered.\n",
  });
  console.log(`  OK  test message sent to ${recipient} (id: ${info.messageId})`);
  process.exit(0);
} catch (error) {
  console.error(`  FAILED  could not send: ${error.message}`);
  process.exit(1);
}
