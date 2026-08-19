import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";

import { createFixtureTracker } from "./fixtures";

/**
 * LIVE PROOF — multi-page proof of delivery.
 *
 * Signed delivery paperwork is photographed page by page, so the thing under
 * test is a *set*: many documents against one delivery, in an order the driver
 * controls, added to over time, and readable only by the organization that owns
 * the delivery.
 *
 * Run against the real database and the real filesystem rather than mocks,
 * because the three properties that matter are all things a mock would assert
 * away:
 *
 *   - the partial unique index is what actually makes an upload retry
 *     idempotent, and only Postgres enforces it;
 *   - ownership is decided by a WHERE clause, and a mocked repository proves
 *     only that the clause was written, not that it filters;
 *   - the file has to land on disk and come back byte-for-byte.
 */

const ORG = "bootstrap-org-001";
const USER = "demo-system-user";

const fixtures = createFixtureTracker();

let storageRoot: string;
let context: AuthenticatedRequestContext;
let otherContext: AuthenticatedRequestContext;
let shipmentId: string;
let secondShipmentId: string;
let salesOrderId: string;

/** Imported after WBOS_STORAGE_ROOT is set — the provider reads it at construction. */
type Service = InstanceType<
  typeof import("@/domains/sales/services/proof-of-delivery-service").ProofOfDeliveryService
>;
let service: Service;

function photo(label: string): Buffer {
  // Distinct bytes per label, so content-hash behaviour is observable.
  return Buffer.from(`\x89PNG\r\n\x1a\n signed page ${label}`, "binary");
}

async function makeShipment(suffix: string): Promise<string> {
  const stamp = `${Date.now()}${suffix}`;

  const warehouse = await prisma.warehouse.create({
    data: {
      organizationId: ORG,
      code: `POD-WH-${stamp}`.slice(0, 20),
      name: `POD warehouse ${suffix}`,
    },
  });
  fixtures.warehouse(warehouse.id);

  return warehouse.id;
}

beforeAll(async () => {
  storageRoot = await mkdtemp(join(tmpdir(), "wbos-pod-"));
  process.env.WBOS_STORAGE_ROOT = storageRoot;

  const { ProofOfDeliveryService } = await import(
    "@/domains/sales/services/proof-of-delivery-service"
  );
  service = new ProofOfDeliveryService();

  context = { organizationId: ORG, userId: USER, role: "OWNER" } as AuthenticatedRequestContext;

  // A real second organization rather than an invented id. Tenant isolation is
  // decided by a WHERE clause; a made-up id would pass even if the clause were
  // comparing against the wrong column.
  const otherOrg = await prisma.organization.create({
    data: { name: `POD isolation org ${Date.now()}` },
  });
  fixtures.organization(otherOrg.id);
  otherContext = {
    organizationId: otherOrg.id,
    userId: USER,
    role: "OWNER",
  } as AuthenticatedRequestContext;

  const customer = await prisma.customer.create({
    data: {
      organizationId: ORG,
      code: `POD-C-${Date.now()}`.slice(0, 20),
      name: "POD test customer",
    },
  });
  fixtures.customer(customer.id);

  const order = await prisma.salesOrder.create({
    data: {
      organizationId: ORG,
      soNumber: `SO-2099-${String(Date.now()).slice(-6)}`,
      customerId: customer.id,
      subtotal: 0,
      totalAmount: 0,
      createdById: USER,
    },
  });
  fixtures.salesOrder(order.id);
  salesOrderId = order.id;

  const warehouseA = await makeShipment("a");
  const warehouseB = await makeShipment("b");

  const first = await prisma.shipment.create({
    data: {
      organizationId: ORG,
      shipmentNumber: `SH-POD-${Date.now()}-1`,
      salesOrderId: order.id,
      warehouseId: warehouseA,
      status: "DELIVERED",
      deliveredAt: new Date(),
      createdById: USER,
    },
  });
  shipmentId = fixtures.shipment(first.id);

  const second = await prisma.shipment.create({
    data: {
      organizationId: ORG,
      shipmentNumber: `SH-POD-${Date.now()}-2`,
      salesOrderId: order.id,
      warehouseId: warehouseB,
      status: "DELIVERED",
      deliveredAt: new Date(),
      createdById: USER,
    },
  });
  secondShipmentId = fixtures.shipment(second.id);
});

afterAll(async () => {
  await fixtures.cleanup();
  delete process.env.WBOS_STORAGE_ROOT;
  await rm(storageRoot, { recursive: true, force: true });
});

describe("a delivery holds many ordered documents", () => {
  it("keeps every page rather than replacing the previous one", async () => {
    const one = await service.upload(context, {
      shipmentId,
      fileName: "page-1.png",
      mimeType: "image/png",
      data: photo("one"),
    });
    const two = await service.upload(context, {
      shipmentId,
      fileName: "page-2.png",
      mimeType: "image/png",
      data: photo("two"),
    });

    expect(one.duplicate).toBe(false);
    expect(two.duplicate).toBe(false);

    const documents = await service.listForDelivery(context, shipmentId);
    expect(documents).toHaveLength(2);
    expect(documents.map((d) => d.fileName)).toEqual(["page-1.png", "page-2.png"]);
    // Page numbers are presented contiguously from 1 regardless of stored values.
    expect(documents.map((d) => d.pageNumber)).toEqual([1, 2]);
  });

  it("writes the bytes to the storage root and serves them from the authenticated route", async () => {
    const documents = await service.listForDelivery(context, shipmentId);
    const first = documents[0];

    expect(first.url.startsWith("/api/uploads/")).toBe(true);
    // Never the public directory: that path is served with no session check.
    expect(first.url.startsWith("/uploads/")).toBe(false);

    const row = await prisma.attachment.findFirstOrThrow({ where: { id: first.id } });
    const onDisk = join(storageRoot, row.storageKey);
    expect(existsSync(onDisk)).toBe(true);
    expect(await readFile(onDisk)).toEqual(photo("one"));
  });

  it("accepts a page added long after the first ones", async () => {
    await service.upload(context, {
      shipmentId,
      fileName: "page-3.png",
      mimeType: "image/png",
      data: photo("three"),
    });

    const documents = await service.listForDelivery(context, shipmentId);
    expect(documents.map((d) => d.fileName)).toEqual(["page-1.png", "page-2.png", "page-3.png"]);
  });

  it("refuses a file type the phone should never produce", async () => {
    await expect(
      service.upload(context, {
        shipmentId,
        fileName: "notes.exe",
        mimeType: "application/x-msdownload",
        data: photo("bad"),
      }),
    ).rejects.toThrow(/photos .* and PDF/i);
  });
});

describe("upload retry", () => {
  it("returns the existing page instead of a second copy when the same bytes arrive twice", async () => {
    const before = await service.listForDelivery(context, shipmentId);

    // Exactly what a handset does when it uploads successfully and then loses
    // the reply: it re-sends the identical photo.
    const retry = await service.upload(context, {
      shipmentId,
      fileName: "page-1.png",
      mimeType: "image/png",
      data: photo("one"),
    });

    expect(retry.duplicate).toBe(true);

    const after = await service.listForDelivery(context, shipmentId);
    expect(after).toHaveLength(before.length);
    expect(retry.document.id).toBe(before[0].id);
  });

  it("survives two identical uploads racing each other", async () => {
    const bytes = photo("raced");
    const [a, b] = await Promise.all([
      service.upload(context, {
        shipmentId: secondShipmentId,
        fileName: "raced.png",
        mimeType: "image/png",
        data: bytes,
      }),
      service.upload(context, {
        shipmentId: secondShipmentId,
        fileName: "raced.png",
        mimeType: "image/png",
        data: bytes,
      }),
    ]);

    // Whichever order they landed in, the delivery holds one page and both
    // callers were told about the same document.
    const documents = await service.listForDelivery(context, secondShipmentId);
    expect(documents).toHaveLength(1);
    expect(a.document.id).toBe(b.document.id);
    expect(a.duplicate || b.duplicate).toBe(true);
  });

  it("has a database index that forbids a duplicate live page regardless of the service", async () => {
    // The race test above is timing-dependent: if the two uploads serialise,
    // the second is caught by the read rather than by the constraint. This
    // asserts the constraint itself, which is the guarantee the service relies
    // on and the only thing that holds across processes.
    const [existing] = await service.listForDelivery(context, secondShipmentId);
    const row = await prisma.attachment.findFirstOrThrow({ where: { id: existing.id } });

    await expect(
      prisma.attachment.create({
        data: {
          organizationId: row.organizationId,
          uploadedById: USER,
          entityType: row.entityType,
          entityId: row.entityId,
          fileName: "a-second-copy.png",
          mimeType: row.mimeType,
          sizeBytes: row.sizeBytes,
          attachmentType: row.attachmentType,
          provider: row.provider,
          storageKey: `${row.storageKey}.copy`,
          sortOrder: row.sortOrder + 1,
          contentHash: row.contentHash,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("lets a removed page be photographed and uploaded again", async () => {
    const [existing] = await service.listForDelivery(context, secondShipmentId);
    await service.remove(context, existing.id);

    const again = await service.upload(context, {
      shipmentId: secondShipmentId,
      fileName: "raced.png",
      mimeType: "image/png",
      data: photo("raced"),
    });

    // A plain UNIQUE constraint would have forbidden this forever; the index is
    // partial on live rows for exactly this case.
    expect(again.duplicate).toBe(false);
    expect(await service.listForDelivery(context, secondShipmentId)).toHaveLength(1);
  });
});

describe("page order", () => {
  it("reorders pages and renumbers them", async () => {
    const before = await service.listForDelivery(context, shipmentId);
    const reversed = [...before].reverse().map((d) => d.id);

    const after = await service.reorder(context, shipmentId, reversed);

    expect(after.map((d) => d.id)).toEqual(reversed);
    expect(after.map((d) => d.pageNumber)).toEqual([1, 2, 3]);
    // Persisted, not just returned.
    const reread = await service.listForDelivery(context, shipmentId);
    expect(reread.map((d) => d.id)).toEqual(reversed);
  });

  it("rejects an order that omits a page", async () => {
    const documents = await service.listForDelivery(context, shipmentId);
    await expect(
      service.reorder(
        context,
        shipmentId,
        documents.slice(1).map((d) => d.id),
      ),
    ).rejects.toThrow(/every document/i);
  });

  it("rejects an order that repeats a page", async () => {
    const documents = await service.listForDelivery(context, shipmentId);
    await expect(
      service.reorder(context, shipmentId, [documents[0].id, documents[0].id, documents[1].id]),
    ).rejects.toThrow(/every document/i);
  });

  it("keeps ordering stable across repeated reads", async () => {
    const a = await service.listForDelivery(context, shipmentId);
    const b = await service.listForDelivery(context, shipmentId);
    expect(a.map((d) => d.id)).toEqual(b.map((d) => d.id));
  });
});

describe("removing a page", () => {
  it("deletes the file and drops it from the set, renumbering the rest", async () => {
    const before = await service.listForDelivery(context, shipmentId);
    const victim = before[1];
    const row = await prisma.attachment.findFirstOrThrow({ where: { id: victim.id } });
    const onDisk = join(storageRoot, row.storageKey);
    expect(existsSync(onDisk)).toBe(true);

    await service.remove(context, victim.id);

    const after = await service.listForDelivery(context, shipmentId);
    expect(after.map((d) => d.id)).not.toContain(victim.id);
    expect(after).toHaveLength(before.length - 1);
    expect(after.map((d) => d.pageNumber)).toEqual([1, 2]);
    expect(existsSync(onDisk)).toBe(false);
  });

  it("reports an already-removed page as missing rather than removing it twice", async () => {
    const [first] = await service.listForDelivery(context, shipmentId);
    await service.remove(context, first.id);
    await expect(service.remove(context, first.id)).rejects.toThrow(/not found/i);
  });
});

describe("the sales order surfaces every delivery's set", () => {
  it("groups documents by delivery instead of flattening them onto the order", async () => {
    const view = await service.listForSalesOrder(context, salesOrderId);

    expect(view.salesOrderId).toBe(salesOrderId);
    expect(view.deliveries).toHaveLength(2);

    const first = view.deliveries.find((d) => d.shipmentId === shipmentId);
    const second = view.deliveries.find((d) => d.shipmentId === secondShipmentId);
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    // Two deliveries, two separate signatures — not one merged pile.
    expect(first!.documents.length).toBeGreaterThan(0);
    expect(second!.documents.length).toBeGreaterThan(0);
    expect(first!.documents.map((d) => d.id)).not.toEqual(second!.documents.map((d) => d.id));
  });

  it("reports the pre-POD single signed invoice separately, without inventing a page 1", async () => {
    await prisma.salesOrder.update({
      where: { id: salesOrderId },
      data: { signedInvoicePath: "/api/uploads/uploads/signed-invoices/org/legacy.pdf" },
    });

    const view = await service.listForSalesOrder(context, salesOrderId);
    expect(view.legacySignedInvoicePath).toContain("legacy.pdf");
    // It is not folded into a delivery's page count.
    const first = view.deliveries.find((d) => d.shipmentId === shipmentId)!;
    expect(first.documents.every((d) => !d.fileName.includes("legacy"))).toBe(true);

    await prisma.salesOrder.update({
      where: { id: salesOrderId },
      data: { signedInvoicePath: null },
    });
  });
});

describe("tenant isolation", () => {
  it("hides another organization's delivery", async () => {
    await expect(service.listForDelivery(otherContext, shipmentId)).rejects.toThrow(/not found/i);
  });

  it("refuses an upload into another organization's delivery", async () => {
    await expect(
      service.upload(otherContext, {
        shipmentId,
        fileName: "intruder.png",
        mimeType: "image/png",
        data: photo("intruder"),
      }),
    ).rejects.toThrow(/not found/i);
  });

  it("refuses to remove another organization's document", async () => {
    const [document] = await service.listForDelivery(context, shipmentId);
    await expect(service.remove(otherContext, document.id)).rejects.toThrow(/not found/i);

    // Still there for its real owner.
    const after = await service.listForDelivery(context, shipmentId);
    expect(after.map((d) => d.id)).toContain(document.id);
  });

  it("refuses to reorder another organization's set", async () => {
    const documents = await service.listForDelivery(context, shipmentId);
    await expect(
      service.reorder(
        otherContext,
        shipmentId,
        documents.map((d) => d.id),
      ),
    ).rejects.toThrow(/not found/i);
  });

  it("hides another organization's sales order", async () => {
    await expect(service.listForSalesOrder(otherContext, salesOrderId)).rejects.toThrow(
      /not found/i,
    );
  });

  it("will not resolve a document for download under the wrong organization", async () => {
    const [document] = await service.listForDelivery(context, shipmentId);

    expect(await service.findForDownload(ORG, document.id)).not.toBeNull();
    // The download route trusts the organization in the signed token; this is
    // the query that has to make a stolen document id useless with it.
    expect(await service.findForDownload(otherContext.organizationId, document.id)).toBeNull();
  });
});
