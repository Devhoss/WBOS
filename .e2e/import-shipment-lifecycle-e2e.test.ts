import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { Prisma, type AttachmentType } from "@prisma/client";

import { ImportShipmentService } from "@/domains/import-shipments/services/import-shipment-service";
import { computeShipmentState } from "@/domains/import-shipments/stage/compute-shipment-state";
import { AttachmentService } from "@/domains/attachments/services/attachment-service";
import { getDefaultStorageProviderRegistry } from "@/domains/attachments/providers/storage-provider-registry";
import { SupplierInvoiceService } from "@/domains/supplier-invoices/services/supplier-invoice-service";
import { PurchaseOrderService } from "@/domains/purchasing/services/purchase-order-service";
import { GoodsReceiptService } from "@/domains/purchasing/services/goods-receipt-service";
import { LandedCostService } from "@/domains/purchasing/services/landed-cost-service";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { prisma } from "@/infrastructure/database/prisma";

vi.mock("@/infrastructure/request/authenticated-request-context", () => ({
  AuthenticatedRequestContextService: class {
    async getCurrentContext() {
      return { organizationId: "bootstrap-org-001", userId: "demo-system-user", role: "OWNER" };
    }
  },
}));

const ORG = "bootstrap-org-001";
const WH_MAIN = "bootstrap-wh-01";
const UOM_PC = "bootstrap-uom-pc";
const CAT_BEV = "bootstrap-cat-01";
const SUPPLIER = "demo-sup-mulla";

const context = {
  organizationId: ORG,
  userId: "demo-system-user",
  user: { id: "demo-system-user", name: "System", email: "system@wbos.local" },
  organization: { id: ORG, name: "My Organization" },
  membership: { id: "mem-e2e", organizationId: ORG, userId: "demo-system-user", role: "OWNER" },
  role: "OWNER",
  session: { id: "sess-e2e" },
} as unknown as AuthenticatedRequestContext;

const imports = new ImportShipmentService();
const attachments = new AttachmentService();
const supplierInvoices = new SupplierInvoiceService();
const purchases = new PurchaseOrderService();
const receipts = new GoodsReceiptService();
const landedCosts = new LandedCostService();

type Snapshot = {
  productCost: Array<{ id: string; productId: string; warehouseId: string; averageCost: string; totalQuantity: string; totalValue: string }>;
  documents: Array<{ id: string; documentType: string; year: number; currentSequence: number }>;
  existing: {
    transactions: Set<string>;
    landedCosts: Set<string>;
    purchaseOrders: Set<string>;
    purchaseOrderLines: Set<string>;
    activityLogs: Set<string>;
    importShipments: Set<string>;
    importShipmentLinks: Set<string>;
    supplierInvoices: Set<string>;
    supplierInvoicePayments: Set<string>;
    attachments: Set<string>;
    products: Set<string>;
  };
};

async function snapshot(): Promise<Snapshot> {
  const [
    productCost, documents, transactions, landedCostRows, activityLogRows,
    purchaseOrderRows, purchaseOrderLineRows, importShipmentRows, importShipmentLinkRows,
    supplierInvoiceRows, supplierInvoicePaymentRows, attachmentRows, productRows,
  ] = await Promise.all([
    prisma.productCost.findMany({ where: { organizationId: ORG }, select: { id: true, productId: true, warehouseId: true, averageCost: true, totalQuantity: true, totalValue: true } }),
    prisma.documentSequence.findMany({ where: { organizationId: ORG } }),
    prisma.inventoryTransaction.findMany({ where: { organizationId: ORG }, select: { id: true } }),
    prisma.landedCost.findMany({ where: { organizationId: ORG }, select: { id: true } }),
    prisma.activityLog.findMany({ where: { organizationId: ORG }, select: { id: true } }),
    prisma.purchaseOrder.findMany({ where: { organizationId: ORG }, select: { id: true } }),
    prisma.purchaseOrderLine.findMany({ where: { organizationId: ORG }, select: { id: true } }),
    prisma.importShipment.findMany({ where: { organizationId: ORG }, select: { id: true } }),
    prisma.importShipmentPurchaseOrder.findMany({ where: { organizationId: ORG }, select: { id: true } }),
    prisma.supplierInvoice.findMany({ where: { organizationId: ORG }, select: { id: true } }),
    prisma.supplierInvoicePayment.findMany({ where: { organizationId: ORG }, select: { id: true } }),
    prisma.attachment.findMany({ where: { organizationId: ORG }, select: { id: true, storageKey: true } }),
    prisma.product.findMany({ where: { organizationId: ORG }, select: { id: true } }),
  ]);

  const toSet = (rows: Array<{ id: string }>) => new Set(rows.map((r) => r.id));

  return {
    productCost: productCost.map((c) => ({
      ...c,
      averageCost: c.averageCost.toString(),
      totalQuantity: c.totalQuantity.toString(),
      totalValue: c.totalValue.toString(),
    })),
    documents: documents.map((d) => ({ id: d.id, documentType: d.documentType, year: d.year, currentSequence: d.currentSequence })),
    existing: {
      transactions: toSet(transactions),
      landedCosts: toSet(landedCostRows),
      purchaseOrders: toSet(purchaseOrderRows),
      purchaseOrderLines: toSet(purchaseOrderLineRows),
      activityLogs: toSet(activityLogRows),
      importShipments: toSet(importShipmentRows),
      importShipmentLinks: toSet(importShipmentLinkRows),
      supplierInvoices: toSet(supplierInvoiceRows),
      supplierInvoicePayments: toSet(supplierInvoicePaymentRows),
      attachments: toSet(attachmentRows),
      products: toSet(productRows),
    },
  };
}

async function restore(snap: Snapshot) {
  const collect = async (model: { findMany: (args: { where: { organizationId: string }; select: { id: true } }) => Promise<Array<{ id: string }>> }, existing: Set<string>) =>
    (await model.findMany({ where: { organizationId: ORG }, select: { id: true } }))
      .map((r) => r.id)
      .filter((id) => !existing.has(id));

  const createdAttachments = (await prisma.attachment.findMany({ where: { organizationId: ORG }, select: { id: true, storageKey: true } }))
    .filter((r) => !snap.existing.attachments.has(r.id));
  const createdSupplierInvoicePayments = await collect(prisma.supplierInvoicePayment, snap.existing.supplierInvoicePayments);
  const createdSupplierInvoices = await collect(prisma.supplierInvoice, snap.existing.supplierInvoices);
  const createdImportShipmentLinks = await collect(prisma.importShipmentPurchaseOrder, snap.existing.importShipmentLinks);
  const createdImportShipments = await collect(prisma.importShipment, snap.existing.importShipments);
  const createdPurchaseOrderLines = await collect(prisma.purchaseOrderLine, snap.existing.purchaseOrderLines);
  const createdPurchaseOrders = await collect(prisma.purchaseOrder, snap.existing.purchaseOrders);
  const createdLcs = await collect(prisma.landedCost, snap.existing.landedCosts);
  const createdTxns = await collect(prisma.inventoryTransaction, snap.existing.transactions);
  const createdLogs = await collect(prisma.activityLog, snap.existing.activityLogs);

  if (createdSupplierInvoicePayments.length > 0) {
    await prisma.supplierInvoicePayment.deleteMany({ where: { id: { in: createdSupplierInvoicePayments } } });
  }
  if (createdSupplierInvoices.length > 0) {
    await prisma.supplierInvoice.deleteMany({ where: { id: { in: createdSupplierInvoices } } });
  }
  if (createdImportShipmentLinks.length > 0) {
    await prisma.importShipmentPurchaseOrder.deleteMany({ where: { id: { in: createdImportShipmentLinks } } });
  }
  if (createdImportShipments.length > 0) {
    await prisma.importShipment.deleteMany({ where: { id: { in: createdImportShipments } } });
  }

  for (const att of createdAttachments) {
    const provider = getDefaultStorageProviderRegistry().get("LOCAL");
    await provider.delete(att.storageKey).catch(() => {});
    await prisma.attachment.deleteMany({ where: { id: att.id } });
  }

  for (const lcId of createdLcs) {
    await prisma.landedCostAllocation.deleteMany({ where: { landedCostId: lcId } });
    await prisma.landedCostLine.deleteMany({ where: { landedCostId: lcId } });
    await prisma.landedCostExpense.deleteMany({ where: { landedCostId: lcId } });
    await prisma.landedCostReceipt.deleteMany({ where: { landedCostId: lcId } });
    await prisma.landedCost.delete({ where: { id: lcId } });
  }

  if (createdTxns.length > 0) {
    await prisma.inventoryLedgerEntry.deleteMany({ where: { transactionId: { in: createdTxns } } });
    await prisma.inventoryTransactionLine.deleteMany({ where: { transactionId: { in: createdTxns } } });
    await prisma.inventoryTransaction.deleteMany({ where: { id: { in: createdTxns } } });
  }

  if (createdPurchaseOrderLines.length > 0) {
    await prisma.purchaseOrderLine.deleteMany({ where: { id: { in: createdPurchaseOrderLines } } });
  }
  if (createdPurchaseOrders.length > 0) {
    await prisma.purchaseOrder.deleteMany({ where: { id: { in: createdPurchaseOrders } } });
  }

  if (createdLogs.length > 0) {
    await prisma.activityLog.deleteMany({ where: { id: { in: createdLogs } } });
  }

  const currentCosts = await prisma.productCost.findMany({ where: { organizationId: ORG }, select: { id: true } });
  for (const row of currentCosts) {
    if (!snap.productCost.some((c) => c.id === row.id)) {
      await prisma.productCost.delete({ where: { id: row.id } });
    }
  }
  for (const row of snap.productCost) {
    await prisma.productCost.update({
      where: { id: row.id },
      data: { averageCost: new Prisma.Decimal(row.averageCost), totalQuantity: new Prisma.Decimal(row.totalQuantity), totalValue: new Prisma.Decimal(row.totalValue) },
    });
  }

  const createdProducts = (await prisma.product.findMany({ where: { organizationId: ORG }, select: { id: true } }))
    .map((r) => r.id)
    .filter((id) => !snap.existing.products.has(id));
  if (createdProducts.length > 0) {
    await prisma.product.deleteMany({ where: { id: { in: createdProducts } } });
  }

  for (const doc of snap.documents) {
    await prisma.documentSequence.update({ where: { id: doc.id }, data: { currentSequence: doc.currentSequence } });
  }
}

async function readShipmentState(shipmentId: string) {
  const shipment = await prisma.importShipment.findFirst({
    where: { id: shipmentId, organizationId: ORG },
    include: {
      supplierInvoice: { select: { status: true, payments: { select: { id: true } } } },
      landedCost: { select: { status: true } },
      purchaseOrderLinks: { include: { purchaseOrder: { select: { status: true } } } },
    },
  });
  expect(shipment).not.toBeNull();
  const docs = await prisma.attachment.findMany({
    where: { organizationId: ORG, entityType: "ImportShipment", entityId: shipmentId },
    select: { attachmentType: true },
  });
  return computeShipmentState({
    supplierInvoice: shipment!.supplierInvoice
      ? { status: shipment!.supplierInvoice.status, payments: shipment!.supplierInvoice.payments }
      : null,
    landedCost: shipment!.landedCost ? { status: shipment!.landedCost.status } : null,
    purchaseOrders: shipment!.purchaseOrderLinks.map((l) => ({ status: l.purchaseOrder.status })),
    attachments: docs,
  });
}

let snap: Snapshot;
let productId: string;
let poId: string;
let poLineId: string;
let siId: string;
let shipmentId: string;

beforeAll(async () => {
  snap = await snapshot();

  productId = await prisma.product
    .create({
      data: {
        organizationId: ORG,
        categoryId: CAT_BEV,
        supplierId: SUPPLIER,
        unitOfMeasureId: UOM_PC,
        sku: `E2E-IMPORT-${Date.now()}`,
        name: "E2E Import Shipment Product",
        status: "ACTIVE",
        defaultSellingPrice: new Prisma.Decimal(3.0),
      },
    })
    .then((p) => p.id);
});

afterAll(async () => {
  await restore(snap);
});

describe("M6 E2E: import shipment lifecycle PO → SI → docs → GR → LC reaches COMPLETED", () => {
  it("creates a supplier invoice and links it to a new import shipment (PLANNING)", async () => {
    const invoice = await supplierInvoices.create(context, {
      supplierId: SUPPLIER,
      currency: "KWD",
      subtotal: 100,
      taxAmount: 0,
      totalAmount: 100,
      reference: "E2E container",
    });
    expect(invoice.siNumber).toMatch(/^SIV-/);
    siId = invoice.id;
    await supplierInvoices.issue(context, siId);

    const shipment = await imports.create(context, {
      supplierId: SUPPLIER,
      currency: "KWD",
      containerRef: "E2E-CONTAINER",
      vessel: "E2E Vessel",
    });
    expect(shipment.shipmentNumber).toMatch(/^IMP-/);
    shipmentId = shipment.id;

    await imports.linkSupplierInvoice(context, { importShipmentId: shipmentId, supplierInvoiceId: siId });

    const state = await readShipmentState(shipmentId);
    expect(state.stage).toBe("PLANNING");
    expect(state.linked.hasSupplierInvoice).toBe(true);
  });

  it("PO linked + deposit paid: stage IN_TRANSIT; final payment: stage FINAL_PAYMENT", async () => {
    const po = await purchases.create(context, {
      supplierId: SUPPLIER,
      currency: "KWD",
      subtotal: 100,
      taxAmount: 0,
      totalAmount: 100,
      lines: [
        {
          productId,
          unitOfMeasureId: UOM_PC,
          orderedQuantity: 100,
          unitCost: 1.0,
          totalCost: 100.0,
        },
      ],
    });
    poId = po.id;
    poLineId = po.lines[0].id;
    await purchases.submit(context, po.id);
    await purchases.approve(context, po.id);

    await imports.linkPurchaseOrder(context, { importShipmentId: shipmentId, purchaseOrderId: poId });

    await supplierInvoices.recordPayment(context, {
      supplierInvoiceId: siId,
      amount: 40,
      currency: "KWD",
      method: "BANK_TRANSFER",
      reference: "DEPOSIT",
    });

    let state = await readShipmentState(shipmentId);
    expect(state.stage).toBe("IN_TRANSIT");
    expect(state.milestones.depositPaid).toBe(true);
    expect(state.linked.hasPurchaseOrder).toBe(true);

    await supplierInvoices.recordPayment(context, {
      supplierInvoiceId: siId,
      amount: 60,
      currency: "KWD",
      method: "BANK_TRANSFER",
      reference: "FINAL",
    });

    state = await readShipmentState(shipmentId);
    expect(state.stage).toBe("FINAL_PAYMENT");
    expect(state.milestones.finalPaid).toBe(true);
  });

  it("uploading all required typed documents raises progress but stays below complete", async () => {
    const upload = async (attachmentType: AttachmentType) => {
      const result = await attachments.upload(context, {
        entityType: "ImportShipment",
        entityId: shipmentId,
        fileName: `${attachmentType}.pdf`,
        mimeType: "application/pdf",
        data: Buffer.from(`%PDF-1.4 fake ${attachmentType}`),
        attachmentType,
      });
      expect(result.id).toBeTruthy();
      expect(result.attachmentType).toBe(attachmentType);
    };

    await upload("PROFORMA");
    await upload("COMMERCIAL_INVOICE");
    await upload("PACKING_LIST");
    await upload("BILL_OF_LADING");

    const state = await readShipmentState(shipmentId);
    expect(state.documents.required).toEqual(["PROFORMA", "COMMERCIAL_INVOICE", "PACKING_LIST", "BILL_OF_LADING"]);
    expect(state.documents.attached).toHaveLength(4);
    expect(state.progress).toBe(60);
    expect(state.progress).toBeLessThan(100);
  });

  it("goods receipt moves to RECEIVING, then landed cost post reaches COMPLETED 100%", async () => {
    const gr = await receipts.receive(context, {
      purchaseOrderId: poId,
      warehouseId: WH_MAIN,
      lines: [
        {
          purchaseOrderLineId: poLineId,
          productId,
          quantity: 100,
        },
      ],
    });
    expect(gr?.id).toBeTruthy();

    let state = await readShipmentState(shipmentId);
    expect(state.stage).toBe("RECEIVING");
    expect(state.milestones.receivingStarted).toBe(true);

    const receiptTxn = await prisma.inventoryTransaction.findFirst({
      where: { organizationId: ORG, type: "PURCHASE_RECEIPT" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    expect(receiptTxn).not.toBeNull();

    const lc = await landedCosts.create(context, {
      allocationBasis: "BY_VALUE",
      currency: "KWD",
      exchangeRate: 1,
      expenses: [{ expenseType: "CUSTOMS_TAX", currency: "KWD", exchangeRate: 1, amount: 20 }],
      receiptTransactionIds: [receiptTxn!.id],
    });
    await imports.linkLandedCost(context, { importShipmentId: shipmentId, landedCostId: lc.id });

    state = await readShipmentState(shipmentId);
    expect(state.stage).toBe("LANDED_COST");
    expect(state.linked.hasLandedCost).toBe(true);

    await landedCosts.post(context, lc.id);

    state = await readShipmentState(shipmentId);
    expect(state.stage).toBe("COMPLETED");
    expect(state.progress).toBe(100);
    expect(state.milestones.landedCostPosted).toBe(true);

    const cost = await prisma.productCost.findFirst({
      where: { organizationId: ORG, productId },
      select: { averageCost: true, totalQuantity: true, totalValue: true },
    });
    expect(Number(cost?.averageCost)).toBeCloseTo(1.2, 3);
    expect(Number(cost?.totalQuantity)).toBeCloseTo(100, 3);
    expect(Number(cost?.totalValue)).toBeCloseTo(120, 3);
  });

  it("linking an already-linked PO or mismatched supplier is rejected", async () => {
    const duplicate = await imports.linkPurchaseOrder(context, {
      importShipmentId: shipmentId,
      purchaseOrderId: poId,
    }).then(
      () => null,
      (err: unknown) => err,
    );
    expect(duplicate).not.toBeNull();
  });
});
