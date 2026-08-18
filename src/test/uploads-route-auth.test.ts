import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BusinessError } from "@/shared/errors/business-error";

/**
 * PROOF TEST for audit finding #1 — attachment auth bypass.
 *
 * These tests describe the CORRECT behaviour and are expected to FAIL against
 * the current implementation. They are the red half of red-green for the fix.
 *
 * Attachments are written to
 *   <STORAGE_ROOT>/uploads/attachments/<orgId>/<entityType>/<entityId>/<file>
 * and the canonical URL is /api/uploads/uploads/attachments/... (doubled
 * prefix, because getUrl() prepends /api/uploads to a storageKey that already
 * begins with "uploads/").
 *
 * The route gates on `safePath.startsWith("uploads/attachments/")` but then
 * resolves candidates from BOTH <ROOT>/uploads/<safePath> and <ROOT>/<safePath>
 * — so dropping one "uploads/" segment reaches the same file with the gate
 * evaluating false.
 */

/**
 * Caller identity is switchable so the same file can be requested as an
 * anonymous visitor, as the owning tenant, and as a different tenant.
 */
let currentOrg: string | null = null;

vi.mock("@/infrastructure/request/authenticated-request-context", () => ({
  AuthenticatedRequestContextService: class {
    async getCurrentContext() {
      if (currentOrg === null) {
        throw new BusinessError("You must be signed in to access WBOS.", "AUTH_REQUIRED");
      }
      return { organizationId: currentOrg, userId: "user-1", role: "OWNER" };
    }
  },
}));

// The attachment row is owned by ORG (declared below); ownership is decided by
// the organizationId in the query, exactly as the route does it.
vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    attachment: {
      findFirst: vi.fn(async ({ where }: { where: { organizationId: string; storageKey: string } }) =>
        where.organizationId === "org-victim" && where.storageKey.includes("supplier-invoice.png")
          ? { id: "att-1" }
          : null,
      ),
    },
  },
}));

let storageRoot: string;
const ORG = "org-victim";
const SECRET_FILE = "supplier-invoice.png";
const RELATIVE = `attachments/${ORG}/SUPPLIER_INVOICE/entity-1/${SECRET_FILE}`;

beforeAll(async () => {
  storageRoot = await mkdtemp(join(tmpdir(), "wbos-uploads-audit-"));
  process.env.WBOS_STORAGE_ROOT = storageRoot;

  const dir = join(storageRoot, "uploads", "attachments", ORG, "SUPPLIER_INVOICE", "entity-1");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, SECRET_FILE), Buffer.from("CONFIDENTIAL-TENANT-DOCUMENT"));
});

afterAll(async () => {
  delete process.env.WBOS_STORAGE_ROOT;
  await rm(storageRoot, { recursive: true, force: true });
});

async function getUpload(pathSegments: string[]) {
  // Imported lazily so the mocked env var is in place first.
  const { GET } = await import("@/app/api/uploads/[...path]/route");
  return GET(new Request("https://wbos.example.com/api/uploads"), {
    params: Promise.resolve({ path: pathSegments }),
  });
}

describe("GET /api/uploads — attachment authorization", () => {
  beforeEach(() => {
    currentOrg = null; // default: anonymous
  });

  it("denies the CANONICAL attachment path to an anonymous caller", async () => {
    // Control case: this is the path the app itself generates, and the gate
    // does fire here. Establishes the intended behaviour.
    const res = await getUpload(["uploads", ...RELATIVE.split("/")]);
    expect(res.status).not.toBe(200);
  });

  it("denies the SAME FILE reached without the 'uploads/' prefix", async () => {
    // The bypass. Same bytes on disk, one URL segment removed, gate evaluates
    // false, file is served to an anonymous caller.
    const res = await getUpload(RELATIVE.split("/"));

    expect(res.status).not.toBe(200);
    if (res.status === 200) {
      const body = await res.text();
      expect(body).not.toContain("CONFIDENTIAL-TENANT-DOCUMENT");
    }
  });

  it("does not mark tenant documents publicly cacheable", async () => {
    currentOrg = ORG; // owning tenant — the only case that gets bytes back
    const res = await getUpload(RELATIVE.split("/"));
    const cache = res.headers.get("cache-control") ?? "";
    expect(cache).not.toMatch(/public/i);
  });

  // ── Tenant isolation ──────────────────────────────────────────────────────

  it("serves the attachment to the OWNING organization", async () => {
    currentOrg = ORG;
    const res = await getUpload(["uploads", ...RELATIVE.split("/")]);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("CONFIDENTIAL-TENANT-DOCUMENT");
  });

  it("denies the attachment to a DIFFERENT organization", async () => {
    currentOrg = "org-attacker";
    const res = await getUpload(["uploads", ...RELATIVE.split("/")]);
    expect(res.status).not.toBe(200);
  });

  it("denies a different organization via the prefix-less path too", async () => {
    currentOrg = "org-attacker";
    const res = await getUpload(RELATIVE.split("/"));
    expect(res.status).not.toBe(200);
  });

  it("cannot distinguish 'not yours' from 'does not exist'", async () => {
    // A different status for the two cases would let an attacker enumerate
    // which documents exist in other organizations.
    currentOrg = "org-attacker";
    const foreign = await getUpload(["uploads", ...RELATIVE.split("/")]);

    currentOrg = ORG;
    const missing = await getUpload([
      "uploads", "attachments", ORG, "SUPPLIER_INVOICE", "entity-1", "no-such-file.png",
    ]);

    expect(foreign.status).toBe(missing.status);
  });

  it("refuses to escape the storage root via traversal", async () => {
    currentOrg = ORG;
    const res = await getUpload(["..", "..", "..", "etc", "passwd"]);
    expect(res.status).not.toBe(200);
  });
});
