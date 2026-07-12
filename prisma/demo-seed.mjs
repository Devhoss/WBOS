import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const YEAR = 2026;
const DEMO_WH_MAIN = "bootstrap-wh-01";
const DEMO_WH_COLD = "bootstrap-wh-02";
const DEMO_UOM_PC = "bootstrap-uom-pc";
const DEMO_UOM_CTN = "bootstrap-uom-ctn";
const DEMO_UOM_CS = "bootstrap-uom-cs";
const DEMO_CAT_BEV = "bootstrap-cat-01";
const DEMO_CAT_DAIRY = "bootstrap-cat-02";
const DEMO_CAT_SNACK = "bootstrap-cat-03";
const DEMO_CAT_COOK = "bootstrap-cat-04";
const DEMO_CAT_RICE = "bootstrap-cat-05";
const DEMO_CAT_FROZEN = "bootstrap-cat-06";

/* ───── Reference Data ───── */

const SUPPLIERS = [
  { id: "demo-sup-mazroua", name: "Al Mazroua Trading Co.", code: "MAZ", contactName: "Khalid Al Mazroua", email: "khalid@almazroua.com", phone: "+965 9900 1001", address: "Sharq, Ahmad Al Jaber St, Kuwait City", paymentTerms: "Net 30", leadTimeDays: 7 },
  { id: "demo-sup-united", name: "United Foodstuff Co.", code: "UFC", contactName: "Ahmed Al Rashid", email: "ahmed@unitedfoodstuff.com", phone: "+965 9900 2002", address: "Shuwaikh Industrial Area, Block 2, Kuwait", paymentTerms: "Net 30", leadTimeDays: 5 },
  { id: "demo-sup-mulla", name: "Al Mulla Beverages", code: "MULLA", contactName: "Faisal Al Mulla", email: "faisal@almulla.com", phone: "+965 9900 3003", address: "Shuwaikh Industrial Area, Block 4, Kuwait", paymentTerms: "Net 15", leadTimeDays: 3 },
  { id: "demo-sup-arzak", name: "Al Arzak Dairy", code: "ARZAK", contactName: "Nasser Al Arzak", email: "nasser@alarzak.com", phone: "+965 9900 4004", address: "Jahra Industrial Area, Block 1, Kuwait", paymentTerms: "Net 30", leadTimeDays: 4 },
  { id: "demo-sup-aseel", name: "Aseel International", code: "ASEEL", contactName: "Yusuf Al Othman", email: "yusuf@aseelintl.com", phone: "+965 9900 5005", address: "Hawally, Tunis St, Kuwait", paymentTerms: "Net 45", leadTimeDays: 10 },
];

const CUSTOMERS = [
  { id: "demo-cus-jazeera", name: "Al Jazeera Supermarket", code: "JAZ", contactName: "Mansour Al Ali", email: "mansour@aljazeeramarket.com", phone: "+965 6600 1001", address: "Salmiya, Block 10, Tunis St, Kuwait", paymentTerms: "Net 30", creditLimit: 5000 },
  { id: "demo-cus-city", name: "City Center Grocery", code: "CITY", contactName: "Hassan Al Jassim", email: "hassan@citycentergrocery.com", phone: "+965 6600 2002", address: "Sharq, Ahmed Al Jaber St, Kuwait City", paymentTerms: "Net 30", creditLimit: 3000 },
  { id: "demo-cus-muthanna", name: "Al Muthanna Restaurant", code: "MUTH", contactName: "Sami Al Muthanna", email: "sami@almuthanna.com", phone: "+965 6600 3003", address: "Fahaheel, Block 5, Gulf St, Kuwait", paymentTerms: "Net 15", creditLimit: 2000 },
  { id: "demo-cus-family", name: "Family Care Co-op", code: "FAM", contactName: "Abdullah Al Shammari", email: "abdullah@familycarecoop.com", phone: "+965 6600 4004", address: "Jabriya, Block 2, Beirut St, Kuwait", paymentTerms: "Net 30", creditLimit: 8000 },
  { id: "demo-cus-salam", name: "Al Salam Catering", code: "SALAM", contactName: "Mohammad Al Enezi", email: "mohammad@alsalamcatering.com", phone: "+965 6600 5005", address: "Mishref, Block 4, Damascus St, Kuwait", paymentTerms: "Net 45", creditLimit: 10000 },
  { id: "demo-cus-ahmed", name: "Ahmed's Mini Mart", code: "AHM", contactName: "Ahmed Al Kandari", email: "ahmed@ahmedminimart.com", phone: "+965 6600 6006", address: "Egaila, Block 1, Cairo St, Kuwait", paymentTerms: "Cash", creditLimit: 500 },
];

const PRODUCTS = [
  { id: "demo-prd-001", name: "Zamzam Sparkling Water 500ml", sku: "ZAM-500", categoryId: DEMO_CAT_BEV, supplierId: "demo-sup-mulla", defaultSellingPrice: 0.150, piecesPerBox: 48 },
  { id: "demo-prd-002", name: "Coca-Cola Can 330ml", sku: "COKE-330", categoryId: DEMO_CAT_BEV, supplierId: "demo-sup-mulla", defaultSellingPrice: 0.250, piecesPerBox: 24 },
  { id: "demo-prd-003", name: "Pepsi Can 330ml", sku: "PEPSI-330", categoryId: DEMO_CAT_BEV, supplierId: "demo-sup-mulla", defaultSellingPrice: 0.250, piecesPerBox: 24 },
  { id: "demo-prd-004", name: "Almarai Fresh Milk 1L", sku: "MILK-1L", categoryId: DEMO_CAT_DAIRY, supplierId: "demo-sup-arzak", defaultSellingPrice: 0.650, piecesPerBox: 12 },
  { id: "demo-prd-005", name: "Almarai Laban 1L", sku: "LABAN-1L", categoryId: DEMO_CAT_DAIRY, supplierId: "demo-sup-arzak", defaultSellingPrice: 0.550, piecesPerBox: 12 },
  { id: "demo-prd-006", name: "Anchor Butter 200g", sku: "BUTTER-200", categoryId: DEMO_CAT_DAIRY, supplierId: "demo-sup-arzak", defaultSellingPrice: 1.200, piecesPerBox: 24 },
  { id: "demo-prd-007", name: "Lay's Chips 45g", sku: "LAYS-45", categoryId: DEMO_CAT_SNACK, supplierId: "demo-sup-united", defaultSellingPrice: 0.350, piecesPerBox: 24 },
  { id: "demo-prd-008", name: "Oreo 12pk", sku: "OREO-12", categoryId: DEMO_CAT_SNACK, supplierId: "demo-sup-united", defaultSellingPrice: 1.500, piecesPerBox: 12 },
  { id: "demo-prd-009", name: "KitKat 4-Finger", sku: "KITKAT-4", categoryId: DEMO_CAT_SNACK, supplierId: "demo-sup-united", defaultSellingPrice: 0.450, piecesPerBox: 24 },
  { id: "demo-prd-010", name: "Mazola Corn Oil 1.5L", sku: "MAZOLA-1.5", categoryId: DEMO_CAT_COOK, supplierId: "demo-sup-aseel", defaultSellingPrice: 2.500, piecesPerBox: 6 },
  { id: "demo-prd-011", name: "Al Joudy Tomato Paste 140g", sku: "TOMATO-140", categoryId: DEMO_CAT_COOK, supplierId: "demo-sup-aseel", defaultSellingPrice: 0.350, piecesPerBox: 24 },
  { id: "demo-prd-012", name: "Abu Tarboosh Basmati Rice 5kg", sku: "RICE-5KG", categoryId: DEMO_CAT_RICE, supplierId: "demo-sup-mazroua", defaultSellingPrice: 3.500, piecesPerBox: 4 },
  { id: "demo-prd-013", name: "Almarai Chicken Nuggets 1kg", sku: "NUGGETS-1KG", categoryId: DEMO_CAT_FROZEN, supplierId: "demo-sup-arzak", defaultSellingPrice: 2.250, piecesPerBox: 10 },
  { id: "demo-prd-014", name: "McCain Frozen Fries 2kg", sku: "FRIES-2KG", categoryId: DEMO_CAT_FROZEN, supplierId: "demo-sup-united", defaultSellingPrice: 1.800, piecesPerBox: 6 },
];

/* ───── Purchase Orders with Full Receipt ───── */

const PURCHASE_ORDERS = [
  {
    id: "demo-po-001", poNumber: "PO-2026-000001", supplierId: "demo-sup-mulla",
    subtotal: 31.600, taxAmount: 0, totalAmount: 31.600, notes: "Beverages stock replenishment",
    orderedAt: new Date("2026-01-05"), status: "FULLY_RECEIVED",
    grnId: "demo-grn-001", grnNumber: "GRN-2026-000001", grnAt: new Date("2026-01-08"),
    lines: [
      { productId: "demo-prd-001", ordered: 200, received: 200, unitCost: 0.050, totalCost: 10.000 },
      { productId: "demo-prd-002", ordered: 150, received: 150, unitCost: 0.080, totalCost: 12.000 },
      { productId: "demo-prd-003", ordered: 120, received: 120, unitCost: 0.080, totalCost: 9.600 },
    ],
  },
  {
    id: "demo-po-002", poNumber: "PO-2026-000002", supplierId: "demo-sup-united",
    subtotal: 384.000, taxAmount: 0, totalAmount: 384.000, notes: "Snacks and frozen stock replenishment",
    orderedAt: new Date("2026-01-10"), status: "FULLY_RECEIVED",
    grnId: "demo-grn-002", grnNumber: "GRN-2026-000002", grnAt: new Date("2026-01-13"),
    lines: [
      { productId: "demo-prd-007", ordered: 400, received: 400, unitCost: 0.150, totalCost: 60.000 },
      { productId: "demo-prd-008", ordered: 150, received: 150, unitCost: 0.800, totalCost: 120.000 },
      { productId: "demo-prd-009", ordered: 300, received: 300, unitCost: 0.200, totalCost: 60.000 },
      { productId: "demo-prd-014", ordered: 120, received: 120, unitCost: 1.200, totalCost: 144.000 },
    ],
  },
  {
    id: "demo-po-003", poNumber: "PO-2026-000003", supplierId: "demo-sup-arzak",
    subtotal: 284.000, taxAmount: 0, totalAmount: 284.000, notes: "Dairy and frozen stock",
    orderedAt: new Date("2026-01-15"), status: "FULLY_RECEIVED",
    grnId: "demo-grn-003", grnNumber: "GRN-2026-000003", grnAt: new Date("2026-01-18"),
    lines: [
      { productId: "demo-prd-004", ordered: 200, received: 200, unitCost: 0.350, totalCost: 70.000 },
      { productId: "demo-prd-005", ordered: 80, received: 80, unitCost: 0.300, totalCost: 24.000 },
      { productId: "demo-prd-006", ordered: 100, received: 100, unitCost: 0.700, totalCost: 70.000 },
      { productId: "demo-prd-013", ordered: 100, received: 100, unitCost: 1.200, totalCost: 120.000 },
    ],
  },
  {
    id: "demo-po-004", poNumber: "PO-2026-000004", supplierId: "demo-sup-aseel",
    subtotal: 220.000, taxAmount: 0, totalAmount: 220.000, notes: "Cooking essentials",
    orderedAt: new Date("2026-01-20"), status: "FULLY_RECEIVED",
    grnId: "demo-grn-004", grnNumber: "GRN-2026-000004", grnAt: new Date("2026-01-23"),
    lines: [
      { productId: "demo-prd-010", ordered: 60, received: 60, unitCost: 1.500, totalCost: 90.000 },
      { productId: "demo-prd-011", ordered: 200, received: 200, unitCost: 0.150, totalCost: 30.000 },
      { productId: "demo-prd-012", ordered: 40, received: 40, unitCost: 2.500, totalCost: 100.000 },
    ],
  },
  {
    id: "demo-po-005", poNumber: "PO-2026-000005", supplierId: "demo-sup-mazroua",
    subtotal: 160.000, taxAmount: 0, totalAmount: 160.000, notes: "Rice and dairy — awaiting delivery",
    orderedAt: new Date("2026-02-25"), status: "APPROVED",
    lines: [
      { productId: "demo-prd-012", ordered: 50, received: 0, unitCost: 2.500, totalCost: 125.000 },
      { productId: "demo-prd-004", ordered: 100, received: 0, unitCost: 0.350, totalCost: 35.000 },
    ],
  },
];

/* ───── Sales Orders ───── */

const SALES_ORDERS = [
  {
    id: "demo-so-001", soNumber: "SO-2026-000001", customerId: "demo-cus-jazeera",
    subtotal: 73.500, taxAmount: 0, totalAmount: 73.500, discountAmount: 0,
    notes: "Weekly store replenishment",
    orderedAt: new Date("2026-02-01"),
    status: "INVOICED",
    lines: [
      { productId: "demo-prd-001", ordered: 50, shipped: 0, unitPrice: 0.150, totalPrice: 7.500 },
      { productId: "demo-prd-002", ordered: 40, shipped: 0, unitPrice: 0.250, totalPrice: 10.000 },
      { productId: "demo-prd-007", ordered: 60, shipped: 0, unitPrice: 0.350, totalPrice: 21.000 },
      { productId: "demo-prd-012", ordered: 10, shipped: 0, unitPrice: 3.500, totalPrice: 35.000 },
    ],
    shipment: null,
    invoice: { invId: "demo-inv-001", invoiceNumber: "INV-2026-000001", status: "ISSUED", amountPaid: 0, issuedAt: new Date("2026-02-01"), dueDate: new Date("2026-03-03") },
    payment: null,
  },
  {
    id: "demo-so-002", soNumber: "SO-2026-000002", customerId: "demo-cus-muthanna",
    subtotal: 76.750, taxAmount: 0, totalAmount: 72.913, discountAmount: 3.838, discountType: "PERCENTAGE", discountRate: 5,
    notes: "Monthly restaurant supply",
    orderedAt: new Date("2026-02-05"),
    status: "PAID",
    lines: [
      { productId: "demo-prd-004", ordered: 30, shipped: 30, unitPrice: 0.650, totalPrice: 19.500 },
      { productId: "demo-prd-005", ordered: 20, shipped: 20, unitPrice: 0.550, totalPrice: 11.000 },
      { productId: "demo-prd-010", ordered: 15, shipped: 15, unitPrice: 2.500, totalPrice: 37.500 },
      { productId: "demo-prd-011", ordered: 25, shipped: 25, unitPrice: 0.350, totalPrice: 8.750 },
    ],
    shipment: { shpId: "demo-shp-002", shipmentNumber: "SHP-2026-000002", status: "DELIVERED", deliveredAt: new Date("2026-02-08"), warehouseId: DEMO_WH_MAIN },
    invoice: { invId: "demo-inv-002", invoiceNumber: "INV-2026-000002", status: "PAID", amountPaid: 72.913, issuedAt: new Date("2026-02-05"), dueDate: new Date("2026-03-07"), paidAt: new Date("2026-02-05") },
    payment: { payId: "demo-pay-001", paymentNumber: "PAY-2026-000001", amount: 72.913, method: "CASH", paidAt: new Date("2026-02-05") },
  },
  {
    id: "demo-so-003", soNumber: "SO-2026-000003", customerId: "demo-cus-ahmed",
    subtotal: 59.000, taxAmount: 0, totalAmount: 59.000, discountAmount: 0,
    notes: "Corner shop stock",
    orderedAt: new Date("2026-02-10"),
    status: "INVOICED",
    lines: [
      { productId: "demo-prd-003", ordered: 20, shipped: 20, unitPrice: 0.250, totalPrice: 5.000 },
      { productId: "demo-prd-008", ordered: 15, shipped: 15, unitPrice: 1.500, totalPrice: 22.500 },
      { productId: "demo-prd-009", ordered: 30, shipped: 30, unitPrice: 0.450, totalPrice: 13.500 },
      { productId: "demo-prd-014", ordered: 10, shipped: 10, unitPrice: 1.800, totalPrice: 18.000 },
    ],
    shipment: { shpId: "demo-shp-003", shipmentNumber: "SHP-2026-000003", status: "DELIVERED", deliveredAt: new Date("2026-02-12"), warehouseId: DEMO_WH_MAIN },
    invoice: { invId: "demo-inv-003", invoiceNumber: "INV-2026-000003", status: "ISSUED", amountPaid: 0, issuedAt: new Date("2026-02-10"), dueDate: new Date("2026-03-12") },
    payment: null,
  },
  {
    id: "demo-so-004", soNumber: "SO-2026-000004", customerId: "demo-cus-family",
    subtotal: 249.250, taxAmount: 0, totalAmount: 224.325, discountAmount: 24.925, discountType: "PERCENTAGE", discountRate: 10,
    notes: "Bulk co-op order",
    orderedAt: new Date("2026-02-15"),
    status: "INVOICED",
    lines: [
      { productId: "demo-prd-006", ordered: 40, shipped: 40, unitPrice: 1.200, totalPrice: 48.000 },
      { productId: "demo-prd-013", ordered: 25, shipped: 25, unitPrice: 2.250, totalPrice: 56.250 },
      { productId: "demo-prd-012", ordered: 20, shipped: 20, unitPrice: 3.500, totalPrice: 70.000 },
      { productId: "demo-prd-010", ordered: 30, shipped: 30, unitPrice: 2.500, totalPrice: 75.000 },
    ],
    shipment: { shpId: "demo-shp-004", shipmentNumber: "SHP-2026-000004", status: "DELIVERED", deliveredAt: new Date("2026-02-18"), warehouseId: DEMO_WH_MAIN },
    invoice: { invId: "demo-inv-004", invoiceNumber: "INV-2026-000004", status: "PARTIALLY_PAID", amountPaid: 124.325, issuedAt: new Date("2026-02-15"), dueDate: new Date("2026-03-17") },
    payment: { payId: "demo-pay-002", paymentNumber: "PAY-2026-000002", amount: 124.325, method: "BANK_TRANSFER", paidAt: new Date("2026-02-20") },
  },
  {
    id: "demo-so-005", soNumber: "SO-2026-000005", customerId: "demo-cus-salam",
    subtotal: 181.000, taxAmount: 0, totalAmount: 181.000, discountAmount: 0,
    notes: "Catering event supplies",
    orderedAt: new Date("2026-02-20"),
    status: "INVOICED",
    lines: [
      { productId: "demo-prd-004", ordered: 60, shipped: 60, unitPrice: 0.650, totalPrice: 39.000 },
      { productId: "demo-prd-005", ordered: 40, shipped: 40, unitPrice: 0.550, totalPrice: 22.000 },
      { productId: "demo-prd-007", ordered: 100, shipped: 100, unitPrice: 0.350, totalPrice: 35.000 },
      { productId: "demo-prd-011", ordered: 50, shipped: 50, unitPrice: 0.350, totalPrice: 17.500 },
      { productId: "demo-prd-013", ordered: 30, shipped: 30, unitPrice: 2.250, totalPrice: 67.500 },
    ],
    shipment: { shpId: "demo-shp-005", shipmentNumber: "SHP-2026-000005", status: "DELIVERED", deliveredAt: new Date("2026-02-23"), warehouseId: DEMO_WH_MAIN },
    invoice: { invId: "demo-inv-005", invoiceNumber: "INV-2026-000005", status: "ISSUED", amountPaid: 0, issuedAt: new Date("2026-02-20"), dueDate: new Date("2026-03-22") },
    payment: null,
  },
];

/* ─── Transaction Helpers ─── */

function docNum(prefix, seq) {
  return `${prefix}-${YEAR}-${String(seq).padStart(6, "0")}`;
}

async function findExistingOrg() {
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) throw new Error("No organization found. Run `npx prisma db seed` first to bootstrap the system.");
  return org;
}

async function ensureDemoUser(orgId) {
  const membership = await prisma.organizationMembership.findFirst({
    where: { organizationId: orgId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
  if (membership) return membership.user;

  const anyUser = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (anyUser) {
    const existingMem = await prisma.organizationMembership.findFirst({
      where: { userId: anyUser.id, organizationId: orgId },
    });
    if (!existingMem) {
      await prisma.organizationMembership.create({
        data: { organizationId: orgId, userId: anyUser.id, role: "OWNER" },
      });
    }
    return anyUser;
  }

  const systemUser = await prisma.user.create({
    data: {
      id: "demo-system-user",
      name: "System",
      email: "system@wbos.local",
      emailVerified: true,
    },
  });
  await prisma.organizationMembership.create({
    data: { organizationId: orgId, userId: systemUser.id, role: "OWNER" },
  });
  console.log("  Created system user for demo data (no Better Auth user exists yet).");
  return systemUser;
}

async function getUoM(uomId) {
  const uom = await prisma.unitOfMeasure.findUnique({ where: { id: uomId } });
  if (!uom) throw new Error(`UoM ${uomId} not found. Run bootstrap seed first.`);
  return uom;
}

async function createIfMissing(model, where, data) {
  const existing = await prisma[model].findFirst({ where });
  if (existing) return existing;
  return prisma[model].create({ data });
}

/* ───── Main ───── */

async function main() {
  const org = await findExistingOrg();
  const user = await ensureDemoUser(org.id);
  const orgId = org.id;

  console.log(`Seeding demo data for organization "${org.name}" (${orgId})...`);

  // ── Verify bootstrap entities exist ──
  const whMain = await prisma.warehouse.findUnique({ where: { id: DEMO_WH_MAIN } });
  const whCold = await prisma.warehouse.findUnique({ where: { id: DEMO_WH_COLD } });
  if (!whMain || !whCold) throw new Error("Bootstrap warehouses not found. Re-run bootstrap seed.");

  // ── 1. Suppliers ──
  console.log("  Creating suppliers...");
  for (const s of SUPPLIERS) {
    await createIfMissing("supplier", { id: s.id }, { organizationId: orgId, ...s });
  }

  // ── 2. Customers ──
  console.log("  Creating customers...");
  for (const c of CUSTOMERS) {
    await createIfMissing("customer", { id: c.id }, { organizationId: orgId, ...c });
  }

  // ── 3. Products ──
  console.log("  Creating products...");
  for (const p of PRODUCTS) {
    await createIfMissing("product", { id: p.id }, {
      organizationId: orgId,
      unitOfMeasureId: DEMO_UOM_PC,
      status: "ACTIVE",
      barcode: p.sku,
      ...p,
    });
  }

  // ── Helper: get product lookup ──
  const productCache = {};
  for (const p of PRODUCTS) {
    productCache[p.id] = await prisma.product.findUnique({ where: { id: p.id } });
  }

  const soLineCache = {};

  // ── 4. Purchase Orders ──
  console.log("  Creating purchase orders...");
  let poSeq = 0;
  for (const po of PURCHASE_ORDERS) {
    poSeq++;
    const poRec = await createIfMissing("purchaseOrder", { id: po.id }, {
      id: po.id,
      organizationId: orgId,
      poNumber: po.poNumber,
      supplierId: po.supplierId,
      status: po.status,
      currency: "KWD",
      subtotal: po.subtotal,
      taxAmount: po.taxAmount,
      totalAmount: po.totalAmount,
      notes: po.notes,
      createdById: user.id,
      orderedAt: po.orderedAt,
    });

    if (po.status !== "APPROVED") {
      for (let i = 0; i < po.lines.length; i++) {
        const l = po.lines[i];
        const pId = "po-line-" + po.id + "-" + String(i + 1).padStart(2, "0");
        await createIfMissing("purchaseOrderLine", { id: pId }, {
          id: pId,
          organizationId: orgId,
          purchaseOrderId: poRec.id,
          productId: l.productId,
          unitOfMeasureId: DEMO_UOM_PC,
          lineNumber: i + 1,
          orderedQuantity: l.ordered,
          receivedQuantity: l.received,
          unitCost: l.unitCost,
          totalCost: l.totalCost,
        });
      }

      if (po.grnId) {
        const grnId = po.grnId;
        const grnTxId = "demo-tx-" + grnId;
        const grnExists = await prisma.inventoryTransaction.findUnique({ where: { id: grnTxId } });
        if (!grnExists) {
          const tx = await prisma.inventoryTransaction.create({
            data: {
              id: grnTxId,
              organizationId: orgId,
              type: "PURCHASE_RECEIPT",
              status: "POSTED",
              documentNumber: po.grnNumber,
              referenceType: "PURCHASE_ORDER",
              referenceId: poRec.id,
              occurredAt: po.grnAt,
              createdById: user.id,
              notes: `Goods receipt for ${po.poNumber}`,
            },
          });

          for (let i = 0; i < po.lines.length; i++) {
            const l = po.lines[i];
            const lineId = "demo-txl-" + grnId + "-" + String(i + 1).padStart(2, "0");
            const txl = await prisma.inventoryTransactionLine.create({
              data: {
                id: lineId,
                organizationId: orgId,
                transactionId: tx.id,
                productId: l.productId,
                unitOfMeasureId: DEMO_UOM_PC,
                quantity: l.received,
                toWarehouseId: whMain.id,
              },
            });

            await prisma.inventoryLedgerEntry.create({
              data: {
                id: "demo-ledge-" + grnId + "-" + String(i + 1).padStart(2, "0"),
                organizationId: orgId,
                transactionId: tx.id,
                transactionLineId: txl.id,
                productId: l.productId,
                warehouseId: whMain.id,
                movementType: "PURCHASE_RECEIPT",
                direction: "IN",
                quantity: l.received,
                occurredAt: po.grnAt,
              },
            });
          }
        }
      }
    } else {
      for (let i = 0; i < po.lines.length; i++) {
        const l = po.lines[i];
        const pId = "po-line-" + po.id + "-" + String(i + 1).padStart(2, "0");
        await createIfMissing("purchaseOrderLine", { id: pId }, {
          id: pId,
          organizationId: orgId,
          purchaseOrderId: poRec.id,
          productId: l.productId,
          unitOfMeasureId: DEMO_UOM_PC,
          lineNumber: i + 1,
          orderedQuantity: l.ordered,
          receivedQuantity: l.received,
          unitCost: l.unitCost,
          totalCost: l.totalCost,
        });
      }
    }
  }

  // ── 5. Sales Orders ──
  console.log("  Creating sales orders...");
  for (const so of SALES_ORDERS) {
    const soRec = await createIfMissing("salesOrder", { id: so.id }, {
      id: so.id,
      organizationId: orgId,
      soNumber: so.soNumber,
      customerId: so.customerId,
      status: so.status,
      currency: "KWD",
      subtotal: so.subtotal,
      taxAmount: so.taxAmount,
      totalAmount: so.totalAmount,
      discountAmount: so.discountAmount,
      discountType: so.discountType || null,
      discountRate: so.discountRate || null,
      notes: so.notes,
      createdById: user.id,
      orderedAt: so.orderedAt,
    });

    for (let i = 0; i < so.lines.length; i++) {
      const l = so.lines[i];
      const solId = "so-line-" + so.id + "-" + String(i + 1).padStart(2, "0");
      const solRec = await createIfMissing("salesOrderLine", { id: solId }, {
        id: solId,
        organizationId: orgId,
        salesOrderId: soRec.id,
        productId: l.productId,
        unitOfMeasureId: DEMO_UOM_PC,
        lineNumber: i + 1,
        orderedQuantity: l.ordered,
        shippedQuantity: l.shipped,
        unitPrice: l.unitPrice,
        totalPrice: l.totalPrice,
        productName: productCache[l.productId].name,
        productSku: productCache[l.productId].sku,
        unitOfMeasureCode: "PC",
        piecesPerBox: productCache[l.productId].piecesPerBox,
      });
      soLineCache[so.id + "-" + i] = solRec;
    }

    // ── Shipment (if applicable) ──
    if (so.shipment) {
      const sh = so.shipment;
      const shpRec = await createIfMissing("shipment", { id: sh.shpId }, {
        id: sh.shpId,
        organizationId: orgId,
        shipmentNumber: sh.shipmentNumber,
        salesOrderId: soRec.id,
        warehouseId: sh.warehouseId,
        status: sh.status,
        createdById: user.id,
        deliveredAt: sh.deliveredAt || null,
      });

      for (let i = 0; i < so.lines.length; i++) {
        const l = so.lines[i];
        if (l.shipped <= 0) continue;
        const solRec = soLineCache[so.id + "-" + i];
        const shlId = "shp-line-" + sh.shpId + "-" + String(i + 1).padStart(2, "0");
        await createIfMissing("shipmentLine", { id: shlId }, {
          id: shlId,
          organizationId: orgId,
          shipmentId: shpRec.id,
          salesOrderLineId: solRec.id,
          productId: l.productId,
          quantity: l.shipped,
          pickedQuantity: l.shipped,
          productName: productCache[l.productId].name,
          productSku: productCache[l.productId].sku,
        });
      }

      // ── Inventory transaction for delivered shipment ──
      if (sh.status === "DELIVERED") {
        const shpTxId = "demo-tx-shp-" + sh.shpId;
        const shpTxExists = await prisma.inventoryTransaction.findUnique({ where: { id: shpTxId } });
        if (!shpTxExists) {
          const tx = await prisma.inventoryTransaction.create({
            data: {
              id: shpTxId,
              organizationId: orgId,
              type: "SALE",
              status: "POSTED",
              documentNumber: sh.shipmentNumber,
              referenceType: "SHIPMENT",
              referenceId: shpRec.id,
              occurredAt: sh.deliveredAt,
              createdById: user.id,
              notes: `Shipment ${sh.shipmentNumber}`,
            },
          });

          for (let i = 0; i < so.lines.length; i++) {
            const l = so.lines[i];
            if (l.shipped <= 0) continue;
            const lineId = "demo-txl-s-" + sh.shpId + "-" + String(i + 1).padStart(2, "0");
            const txl = await prisma.inventoryTransactionLine.create({
              data: {
                id: lineId,
                organizationId: orgId,
                transactionId: tx.id,
                productId: l.productId,
                unitOfMeasureId: DEMO_UOM_PC,
                quantity: l.shipped,
                fromWarehouseId: sh.warehouseId,
              },
            });

            await prisma.inventoryLedgerEntry.create({
              data: {
                id: "demo-ledge-s-" + sh.shpId + "-" + String(i + 1).padStart(2, "0"),
                organizationId: orgId,
                transactionId: tx.id,
                transactionLineId: txl.id,
                productId: l.productId,
                warehouseId: sh.warehouseId,
                movementType: "SALE",
                direction: "OUT",
                quantity: l.shipped,
                occurredAt: sh.deliveredAt,
              },
            });
          }
        }
      }
    }

    // ── Invoice ──
    if (so.invoice) {
      const inv = so.invoice;
      const invRec = await createIfMissing("invoice", { id: inv.invId }, {
        id: inv.invId,
        organizationId: orgId,
        invoiceNumber: inv.invoiceNumber,
        salesOrderId: soRec.id,
        customerId: so.customerId,
        status: inv.status,
        currency: "KWD",
        subtotal: so.subtotal,
        taxAmount: so.taxAmount,
        totalAmount: so.totalAmount,
        discountAmount: so.discountAmount,
        discountType: so.discountType || null,
        discountRate: so.discountRate || null,
        amountPaid: inv.amountPaid,
        issuedAt: inv.issuedAt,
        dueDate: inv.dueDate,
        paidAt: inv.paidAt || null,
        customerName: CUSTOMERS.find((c) => c.id === so.customerId).name,
        customerAddress: CUSTOMERS.find((c) => c.id === so.customerId).address,
        paymentTerms: CUSTOMERS.find((c) => c.id === so.customerId).paymentTerms,
        notes: so.notes,
        warehouseName: "Main Warehouse",
        deliveryStatus: so.shipment ? (so.shipment.status === "DELIVERED" ? "Delivered" : null) : null,
      });

      for (let i = 0; i < so.lines.length; i++) {
        const l = so.lines[i];
        const solRec = soLineCache[so.id + "-" + i];
        const invlId = "inv-line-" + inv.invId + "-" + String(i + 1).padStart(2, "0");
        await createIfMissing("invoiceLine", { id: invlId }, {
          id: invlId,
          organizationId: orgId,
          invoiceId: invRec.id,
          salesOrderLineId: solRec.id,
          productId: l.productId,
          unitOfMeasureId: DEMO_UOM_PC,
          lineNumber: i + 1,
          quantity: l.ordered,
          unitPrice: l.unitPrice,
          totalPrice: l.totalPrice,
          productName: productCache[l.productId].name,
          productSku: productCache[l.productId].sku,
          unitOfMeasureCode: "PC",
          piecesPerBox: productCache[l.productId].piecesPerBox,
        });
      }

      // ── Payment (if applicable) ──
      if (so.payment) {
        const pay = so.payment;
        await createIfMissing("payment", { id: pay.payId }, {
          id: pay.payId,
          organizationId: orgId,
          paymentNumber: pay.paymentNumber,
          invoiceId: invRec.id,
          customerId: so.customerId,
          amount: pay.amount,
          currency: "KWD",
          method: pay.method,
          paidAt: pay.paidAt,
          notes: `Payment for ${inv.invoiceNumber}`,
        });
      }
    }
  }

  // ── 6. Update document sequences ──
  console.log("  Updating document sequences...");
  const sequenceUpdates = [
    { docType: "PO", seq: 5 },
    { docType: "GRN", seq: 4 },
    { docType: "SO", seq: 5 },
    { docType: "SHP", seq: 5 },
    { docType: "INV", seq: 5 },
    { docType: "PAY", seq: 2 },
  ];
  for (const su of sequenceUpdates) {
    await prisma.documentSequence.updateMany({
      where: { organizationId: orgId, documentType: su.docType, year: YEAR },
      data: { currentSequence: su.seq },
    });
  }

  // ── 7. Activity log ──
  await prisma.activityLog.create({
    data: {
      organizationId: orgId,
      userId: user.id,
      action: "DEMO_SEED",
      entityType: "Organization",
      entityId: orgId,
      summary: `Demo data seeded: ${PRODUCTS.length} products, ${SUPPLIERS.length} suppliers, ${CUSTOMERS.length} customers, ${PURCHASE_ORDERS.length} purchase orders, ${SALES_ORDERS.length} sales orders.`,
    },
  });

  console.log("");
  console.log("✓ Demo data seeded successfully.");
  console.log(`  ${SUPPLIERS.length} suppliers`);
  console.log(`  ${CUSTOMERS.length} customers`);
  console.log(`  ${PRODUCTS.length} products`);
  console.log(`  ${PURCHASE_ORDERS.length} purchase orders (${PURCHASE_ORDERS.filter((p) => p.status === "FULLY_RECEIVED").length} received)`);
  console.log(`  ${SALES_ORDERS.length} sales orders`);
  console.log(`  ${SALES_ORDERS.filter((s) => s.shipment).length} shipments (${SALES_ORDERS.filter((s) => s.shipment?.status === "DELIVERED").length} delivered)`);
  console.log(`  ${SALES_ORDERS.length} invoices (${SALES_ORDERS.filter((s) => s.invoice?.status === "PAID").length} paid, ${SALES_ORDERS.filter((s) => s.invoice?.status === "PARTIALLY_PAID").length} partially paid)`);
  console.log(`  ${SALES_ORDERS.filter((s) => s.payment).length} payments`);
  console.log("");
  console.log("  Outstanding balances:");
  for (const so of SALES_ORDERS) {
    if (!so.invoice) continue;
    const balance = so.totalAmount - so.invoice.amountPaid;
    if (balance > 0) {
      const cus = CUSTOMERS.find((c) => c.id === so.customerId);
      console.log(`  ${cus.name}: ${balance.toFixed(3)} KWD (${so.invoice.invoiceNumber})`);
    }
  }
  console.log("");
  console.log("Useful development credentials:");
  console.log(`  Organization: ${org.name}`);
  console.log(`  Admin email: ${user.email}`);
  console.log(`  Demo commands:  npm run db:demo   (re-run this seed)`);
  console.log(`  Full reset:     npm run db:fresh  (migrate reset + demo)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
