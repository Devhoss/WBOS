/**
 * WBOS Alpha E2E Workflow Validation
 *
 * Self-contained end-to-end validation of the complete warehouse workflow:
 *   SO creation → approval → shipment → pick task → picking → completion
 *
 * Creates all required test data (warehouse, products, customer, UoM)
 * and validates state at every step.
 *
 * Run: npx tsx validation/e2e-workflow.ts
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { SalesOrderService } from "../src/domains/sales/services/sales-order-service";
import { ShipmentService } from "../src/domains/sales/services/shipment-service";
import { TaskDomainService } from "../src/domains/tasks/services/task-domain-service";
import { TaskRepository } from "../src/domains/tasks/repositories/task-repository";

const prisma = new PrismaClient();
const STEP = "  \u2713";
const FAIL = "  \u2717";
const TAG = "[E2E]";

let passed = 0;
let failed = 0;
const errors: string[] = [];

function check(condition: boolean, message: string) {
  if (condition) {
    console.log(`${STEP} ${message}`);
    passed++;
  } else {
    console.log(`${FAIL} ${message}`);
    failed++;
    errors.push(message);
  }
}

// ── Helpers ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockContext(org: any, user: any) {
  return {
    organizationId: org.id,
    userId: user.id,
    role: "ADMIN",
    session: { id: "validation-session" },
    ipAddress: "127.0.0.1",
    userAgent: "validation-script",
  };
}

async function findOrgAndUser() {
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) throw new Error("No organization found.");
  const membership = await prisma.organizationMembership.findFirst({
    where: { organizationId: org.id },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) throw new Error("No organization members found.");
  return { org, user: membership.user };
}

async function ensureWarehouse(orgId: string) {
  let wh = await prisma.warehouse.findFirst({
    where: { organizationId: orgId, isDefault: true },
  });
  if (!wh) {
    wh = await prisma.warehouse.findFirst({ where: { organizationId: orgId } });
  }
  if (!wh) {
    wh = await prisma.warehouse.create({
      data: {
        organizationId: orgId,
        name: "E2E Test Warehouse",
        code: "E2E",
        isDefault: true,
        address: "Test Location",
      },
    });
    console.log(`  ${TAG} Created warehouse: ${wh.name} (${wh.id})`);
  }
  return wh;
}

async function ensureUom(orgId: string) {
  let uom = await prisma.unitOfMeasure.findFirst({
    where: { organizationId: orgId, isBaseUnit: true },
  });
  if (!uom) {
    uom = await prisma.unitOfMeasure.create({
      data: {
        organizationId: orgId,
        name: "Piece",
        code: "PC",
        isBaseUnit: true,
        conversionToBase: 1,
      },
    });
    console.log(`  ${TAG} Created UoM: ${uom.code}`);
  }
  return uom;
}

async function ensureCategory(orgId: string) {
  let cat = await prisma.category.findFirst({ where: { organizationId: orgId } });
  if (!cat) {
    cat = await prisma.category.create({
      data: { organizationId: orgId, name: "E2E Test Category", code: "E2E-CAT" },
    });
    console.log(`  ${TAG} Created category: ${cat.name}`);
  }
  return cat;
}

async function ensureProducts(orgId: string, uomId: string, categoryId: string) {
  const existing = await prisma.product.findFirst({ where: { organizationId: orgId } });
  if (existing) {
    const all = await prisma.product.findMany({ where: { organizationId: orgId }, take: 3 });
    return all;
  }

  const products = [
    { name: "E2E Test Product Alpha", sku: "E2E-ALPHA-001", defaultSellingPrice: 1.5, piecesPerBox: 12 },
    { name: "E2E Test Product Beta", sku: "E2E-BETA-002", defaultSellingPrice: 2.25, piecesPerBox: 6 },
    { name: "E2E Test Product Gamma", sku: "E2E-GAMMA-003", defaultSellingPrice: 0.75, piecesPerBox: 24 },
  ];

  const created = [];
  for (const p of products) {
    const prod = await prisma.product.create({
      data: {
        organizationId: orgId,
        categoryId,
        unitOfMeasureId: uomId,
        status: "ACTIVE",
        ...p,
      },
    });
    created.push(prod);
  }
  console.log(`  ${TAG} Created ${created.length} E2E products`);
  return created;
}

async function ensureCustomer(orgId: string) {
  const existing = await prisma.customer.findFirst({ where: { organizationId: orgId } });
  if (existing) return existing;

  const customer = await prisma.customer.create({
    data: {
      organizationId: orgId,
      name: "E2E Test Customer",
      code: "E2E-CUST",
      contactName: "Test Contact",
      email: "e2e@test.local",
      phone: "+965 0000 0000",
      address: "Test Address",
      paymentTerms: "Net 30",
      creditLimit: 10000,
    },
  });
  console.log(`  ${TAG} Created customer: ${customer.name}`);
  return customer;
}

async function ensureInventory(orgId: string, warehouseId: string, products: { id: string; unitOfMeasureId: string }[]) {
  // Check if we already have stock for these products
  const existingLedger = await prisma.inventoryLedgerEntry.findFirst({
    where: { organizationId: orgId, warehouseId },
  });
  if (existingLedger) return;

  const tx = await prisma.inventoryTransaction.create({
    data: {
      organizationId: orgId,
      type: "PURCHASE_RECEIPT",
      status: "POSTED",
      documentNumber: "E2E-GRN-001",
      referenceType: "PURCHASE_ORDER",
      referenceId: "e2e-po",
      occurredAt: new Date(),
      createdById: (await prisma.user.findFirst())!.id,
      notes: "E2E validation stock receipt",
    },
  });

  for (const p of products) {
    const qty = 100;
    const txl = await prisma.inventoryTransactionLine.create({
      data: {
        organizationId: orgId,
        transactionId: tx.id,
        productId: p.id,
        unitOfMeasureId: p.unitOfMeasureId,
        quantity: qty,
        toWarehouseId: warehouseId,
      },
    });
    await prisma.inventoryLedgerEntry.create({
      data: {
        organizationId: orgId,
        transactionId: tx.id,
        transactionLineId: txl.id,
        productId: p.id,
        warehouseId,
        movementType: "PURCHASE_RECEIPT",
        direction: "IN",
        quantity: qty,
        occurredAt: new Date(),
      },
    });
  }
  console.log(`  ${TAG} Created stock for ${products.length} products (100 units each)`);
}

async function cleanupTestData(soId?: string, shipmentId?: string, taskId?: string) {
  if (soId) {
    // Delete task lines, task
    if (taskId) {
      await prisma.taskLine.deleteMany({ where: { taskId } });
      await prisma.task.deleteMany({ where: { id: taskId } });
    }
    // Delete shipment lines, shipment
    if (shipmentId) {
      await prisma.shipmentLine.deleteMany({ where: { shipmentId } });
      await prisma.shipment.deleteMany({ where: { id: shipmentId } });
    }
    // Delete invoice + payments
    const invoices = await prisma.invoice.findMany({ where: { salesOrderId: soId } });
    for (const inv of invoices) {
      await prisma.payment.deleteMany({ where: { invoiceId: inv.id } });
    }
    await prisma.invoice.deleteMany({ where: { salesOrderId: soId } });
    // Delete SO lines, SO
    await prisma.salesOrderLine.deleteMany({ where: { salesOrderId: soId } });
    await prisma.salesOrder.deleteMany({ where: { id: soId } });
    // Clean activity logs
    await prisma.activityLog.deleteMany({ where: { entityId: { in: [soId, shipmentId, taskId].filter(Boolean) } } });
  }
}

// ── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
//  MAIN
// ── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
async function main() {
  const cleanup = process.argv.includes("--cleanup");
  const skipCleanup = process.argv.includes("--keep");

  console.log("\n\u2550\u2550\u2550 WBOS Alpha E2E Workflow Validation \u2550\u2550\u2550\n");

  // ── 0. Bootstrap check ──
  console.log("\u2500\u2500 0. System Bootstrap \u2500\u2500");
  const { org, user } = await findOrgAndUser();
  check(!!org, `Organization "${org.name}" exists (${org.id})`);
  check(!!user, `User "${user.name || user.email}" exists (${user.id})`);

  const ctx = mockContext(org, user);

  // Ensure test data
  const warehouse = await ensureWarehouse(org.id);
  check(!!warehouse, `Warehouse "${warehouse.name}" ready (${warehouse.id})`);

  const uom = await ensureUom(org.id);
  check(!!uom, `UoM "${uom.code}" ready`);

  const category = await ensureCategory(org.id);
  check(!!category, `Category "${category.name}" ready`);

  const products = await ensureProducts(org.id, uom.id, category.id);
  check(products.length >= 2, `${products.length} products ready`);

  const customer = await ensureCustomer(org.id);
  check(!!customer, `Customer "${customer.name}" ready`);

  await ensureInventory(org.id, warehouse.id, products);

  let soId: string | undefined;
  let shipmentId: string | undefined;
  let taskId: string | undefined;

  try {
    // ── 1. Create Sales Order (DRAFT) ──
    console.log("\n\u2500\u2500 1. Create Sales Order \u2500\u2500");
    const soService = new SalesOrderService();
    const lineDefs = [
      { product: products[0], qty: 10 },
      { product: products[1], qty: 5 },
    ];

    const soInput = {
      customerId: customer.id,
      currency: "KWD" as const,
      subtotal: 0,
      taxAmount: 0,
      totalAmount: 0,
      discountAmount: 0,
      lines: lineDefs.map((ld) => {
        const totalPrice = ld.qty * Number(ld.product.defaultSellingPrice || 0.5);
        return {
          productId: ld.product.id,
          unitOfMeasureId: uom.id,
          orderedQuantity: ld.qty,
          unitPrice: Number(ld.product.defaultSellingPrice || 0.5),
          totalPrice,
          productName: ld.product.name,
          productSku: ld.product.sku,
          unitOfMeasureCode: uom.code,
        };
      }),
    };
    soInput.subtotal = soInput.lines.reduce((s, l) => s + l.totalPrice, 0);
    soInput.totalAmount = soInput.subtotal;

    const { order } = await soService.create(ctx, soInput);
    soId = order.id;
    check(!!order?.id, `Sales Order created: ${order.soNumber} (${order.id})`);
    check(order.status === "DRAFT", "Status is DRAFT");

    // ── 2. Submit for Approval ──
    console.log("\n\u2500\u2500 2. Submit for Approval \u2500\u2500");
    await soService.submit(ctx, soId);
    const submitted = await prisma.salesOrder.findUnique({ where: { id: soId } });
    check(submitted?.status === "PENDING_APPROVAL", `Status transitions to PENDING_APPROVAL (got ${submitted?.status})`);

    // ── 3. Approve (auto-generates invoice → SO goes to INVOICED) ──
    console.log("\n\u2500\u2500 3. Approve \u2500\u2500");
    await soService.approve(ctx, soId);
    const approved = await prisma.salesOrder.findUnique({ where: { id: soId } });
    check(approved?.status === "INVOICED", `Status transitions to INVOICED on auto-invoice (got ${approved?.status})`);
    check(!!approved?.approvedById, "approvedById is set");

    // ── 4. Verify auto-generated invoice ──
    console.log("\n\u2500\u2500 4. Auto-Invoice \u2500\u2500");
    const invoice = await prisma.invoice.findFirst({
      where: { salesOrderId: soId, organizationId: org.id },
    });
    check(!!invoice, `Invoice auto-generated: ${invoice?.invoiceNumber}`);
    check(invoice?.status === "ISSUED", `Invoice status is ISSUED (got ${invoice?.status})`);

    // ── 5. Create Shipment ──
    console.log("\n\u2500\u2500 5. Create Shipment \u2500\u2500");
    const shipService = new ShipmentService();
    const orderedSo = await prisma.salesOrder.findUnique({
      where: { id: soId },
      include: { lines: true },
    });

    const shipmentInput = {
      salesOrderId: soId!,
      warehouseId: warehouse.id,
      notes: "E2E validation shipment",
      lines: orderedSo!.lines.map((l) => ({
        salesOrderLineId: l.id,
        productId: l.productId,
        quantity: Number(l.orderedQuantity),
        productName: l.productName,
        productSku: l.productSku,
      })),
    };
    const shipment = await shipService.create(ctx, shipmentInput);
    shipmentId = shipment.id;
    check(!!shipment?.id, `Shipment created: ${shipment.shipmentNumber} (${shipment.id})`);
    check(shipment.status === "PENDING_PICK", `Status is PENDING_PICK (got ${shipment.status})`);

    const shipmentLines = await prisma.shipmentLine.findMany({ where: { shipmentId: shipment.id } });
    check(shipmentLines.length === orderedSo!.lines.length, `Shipment has ${shipmentLines.length} line(s)`);

    // ── 6. Create Pick Task ──
    console.log("\n\u2500\u2500 6. Create Pick Task \u2500\u2500");
    const taskDomain = new TaskDomainService();
    const fullShipment = await prisma.shipment.findUnique({
      where: { id: shipment.id },
      include: {
        lines: { include: { product: true } },
        salesOrder: { include: { customer: true } },
        warehouse: true,
      },
    });
    const task = await taskDomain.createFromShipment(ctx, fullShipment);
    taskId = task.id;
    check(!!task?.id, `Pick Task created: ${task.taskNumber} (${task.id})`);
    check(task.status === "ASSIGNED", `Task status is ASSIGNED (got ${task.status})`);
    check(task.type === "PICK_ORDER", "Task type is PICK_ORDER");
    check(task.referenceType === "SALES_ORDER", "Reference type is SALES_ORDER");
    check(task.referenceId === soId, "Reference points to correct Sales Order");
    check(task.lines.length === shipmentLines.length, `Task has ${task.lines.length} line(s)`);
    check(task.assignedTo?.id === user.id, "Task assigned to current user");

    // ── 7. Verify Task appears in repository queries ──
    console.log("\n\u2500\u2500 7. Task Repository Queries \u2500\u2500");
    const taskRepo = new TaskRepository();
    const listed = await taskRepo.findMany(org.id, { status: "ASSIGNED" });
    check(listed.data.some((t) => t.id === taskId), "Found in findMany with ASSIGNED filter");

    const byType = await taskRepo.findMany(org.id, { type: "PICK_ORDER" });
    check(byType.data.some((t) => t.id === taskId), "Found in findMany with PICK_ORDER filter");

    const countActive = await taskRepo.countActiveByReference(org.id, "SALES_ORDER", soId!);
    check(countActive === 1, "countActiveByReference returns 1 (task is not yet started)");

    // ── 8. Start Task ──
    console.log("\n\u2500\u2500 8. Start Task \u2500\u2500");
    const started = await taskDomain.start(ctx, taskId, task.updatedAt);
    check(started.status === "IN_PROGRESS", `Task transitions to IN_PROGRESS (got ${started.status})`);
    check(!!started.startedAt, "startedAt is set");

    // Verify countActiveByReference still returns 1 (in_progress counts too)
    const countInProgress = await taskRepo.countActiveByReference(org.id, "SALES_ORDER", soId!);
    check(countInProgress === 1, "countActiveByReference returns 1 for IN_PROGRESS task");

    // ── 9. Update Task Lines (simulate picking) ──
    console.log("\n\u2500\u2500 9. Pick Products \u2500\u2500");
    let currentState = started;

    for (let i = 0; i < started.lines.length; i++) {
      const line = started.lines[i];
      const pickQty = Number(line.quantityOrdered);

      console.log(`     Line ${i + 1}: ${line.productName} (${line.productSku}) \u2014 ${pickQty} units`);
      const updated = await taskDomain.updateLine(ctx, taskId, line.id, pickQty);
      check(Number(updated.lines[i].completedQuantity) === pickQty, `Line ${i + 1} updated to ${pickQty}`);
      currentState = updated;
    }

    const shipAfterPick = await prisma.shipment.findUnique({ where: { id: shipment.id } });
    check(shipAfterPick?.status === "PICKED", `Shipment auto-transitions to PICKED (got ${shipAfterPick?.status})`);

    // ── 10. Complete Task ──
    console.log("\n\u2500\u2500 10. Complete Task \u2500\u2500");
    const completedTask = await taskDomain.complete(ctx, taskId, currentState.updatedAt);
    check(completedTask.status === "COMPLETED", `Task transitions to COMPLETED (got ${completedTask.status})`);
    check(!!completedTask.completedAt, "completedAt is set");

    // ── 11. Validate Final States ──
    console.log("\n\u2500\u2500 11. Final State Validation \u2500\u2500");
    const finalTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: { lines: true },
    });
    check(finalTask?.status === "COMPLETED", "DB: Task status is COMPLETED");
    check(finalTask?.lines.every((l) => Number(l.completedQuantity) > 0) ?? false, "DB: All task lines have picked quantities");

    const finalShipment = await prisma.shipment.findUnique({
      where: { id: shipment.id },
      include: { lines: true },
    });
    check(finalShipment?.status === "PICKED", "DB: Shipment status is PICKED");
    check(
      finalShipment?.lines.every((l) => Number(l.pickedQuantity) >= Number(l.quantity)) ?? false,
      "DB: All shipment lines fully picked",
    );

    const finalSO = await prisma.salesOrder.findUnique({ where: { id: soId } });
    check(finalSO?.status === "INVOICED", "DB: Sales Order remains INVOICED (unchanged by picking/workflow)");
    check(!!finalSO?.approvedById, "DB: approvedById still set");

    // ── 12. Activity Logs ──
    console.log("\n\u2500\u2500 12. Activity Logs \u2500\u2500");
    const taskLogs = await prisma.activityLog.findMany({
      where: { entityType: "Task", entityId: taskId },
      orderBy: { createdAt: "asc" },
    });
    const logActions = taskLogs.map((l) => l.action);
    check(taskLogs.length >= 4, `At least 4 activity logs for task (found ${taskLogs.length})`);
    check(logActions.includes("TASK_CREATED"), "TASK_CREATED logged");
    check(logActions.includes("TASK_STARTED"), "TASK_STARTED logged");
    check(logActions.includes("TASK_LINE_UPDATED"), "TASK_LINE_UPDATED logged");
    check(logActions.includes("TASK_COMPLETED"), "TASK_COMPLETED logged");

    const shipLogs = await prisma.activityLog.findMany({
      where: { entityType: "Shipment", entityId: shipment.id },
      orderBy: { createdAt: "asc" },
    });
    const shipActions = shipLogs.map((l) => l.action);
    check(shipActions.includes("SHIPMENT_CREATED"), "SHIPMENT_CREATED logged");
    check(shipActions.includes("SHIPMENT_PICKING"), "SHIPMENT_PICKING logged");
    check(shipActions.includes("SHIPMENT_PICKED"), "SHIPMENT_PICKED logged");

    const soLogs = await prisma.activityLog.findMany({
      where: { entityType: "SalesOrder", entityId: soId },
      orderBy: { createdAt: "asc" },
    });
    const soActions = soLogs.map((l) => l.action);
    check(soActions.includes("SALES_ORDER_CREATED"), "SALES_ORDER_CREATED logged");
    check(soActions.includes("SALES_ORDER_SUBMITTED"), "SALES_ORDER_SUBMITTED logged");
    check(soActions.includes("SALES_ORDER_APPROVED"), "SALES_ORDER_APPROVED logged");

    // ── 13. Invalid State Transition Guards ──
    console.log("\n\u2500\u2500 13. Invalid State Transition Guards \u2500\u2500");
    try {
      await taskDomain.complete(ctx, taskId, currentState.updatedAt);
      check(false, "Should reject complete on COMPLETED task");
    } catch (e) {
      check(e instanceof Error && e.message?.includes("IN_PROGRESS"), "Rejects complete on COMPLETED task");
    }

    try {
      await taskDomain.start(ctx, taskId, currentState.updatedAt);
      check(false, "Should reject start on COMPLETED task");
    } catch (e) {
      check(e instanceof Error && e.message?.includes("ASSIGNED"), "Rejects start on COMPLETED task");
    }

    try {
      await taskDomain.cancel(ctx, taskId, "test", currentState.updatedAt);
      check(false, "Should reject cancel on COMPLETED task");
    } catch (e) {
      check(e instanceof Error && (e.message?.includes("current state") || e.message?.includes("COMPLETED")), "Rejects cancel on COMPLETED task");
    }

    // ── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
    //  SUMMARY
    // ── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
    console.log("\n\u2550\u2550\u2550 Results \u2550\u2550\u2550");
    console.log(`  Passed: ${passed}`);
    console.log(`  Failed: ${failed}`);
    if (errors.length > 0) {
      console.log("\n  Failures:");
      errors.forEach((e) => console.log(`    ${FAIL} ${e}`));
    }
    console.log(`\n  Test data: SO ${soId}, Shipment ${shipmentId}, Task ${taskId}`);

  } finally {
    if (cleanup) {
      console.log(`  ${TAG} Cleaning up test data...`);
      await cleanupTestData(soId, shipmentId, taskId);
      console.log(`  ${TAG} Cleanup complete.`);
    } else if (!skipCleanup) {
      console.log(`  ${TAG} Data preserved for inspection.`);
      console.log(`  ${TAG} To clean up: npx tsx validation/e2e-workflow.ts --cleanup`);
      console.log(`  ${TAG} To skip this message: npx tsx validation/e2e-workflow.ts --keep`);
    }
  }

  process.exitCode = failed > 0 ? 1 : 0;
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Validation failed with error:", e);
  process.exitCode = 1;
  prisma.$disconnect();
});
