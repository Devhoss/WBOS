import { describe, it, expect } from "vitest";

import {
  computeShipmentState,
  IMPORT_SHIPMENT_STAGES,
  OPTIONAL_ATTACHMENT_TYPES,
  REQUIRED_ATTACHMENT_TYPES,
} from "@/domains/import-shipments/stage/compute-shipment-state";

describe("computeShipmentState", () => {
  const base = {
    supplierInvoice: null,
    landedCost: null,
    purchaseOrders: [],
  };

  it("PLANNING when nothing is linked", () => {
    const state = computeShipmentState(base);
    expect(state.stage).toBe("PLANNING");
    expect(state.stageIndex).toBe(0);
    expect(state.progress).toBe(0);
  });

  it("IN_TRANSIT once a deposit (first payment) is recorded", () => {
    const state = computeShipmentState({
      ...base,
      supplierInvoice: { status: "ISSUED", payments: [{ id: "p1" }] },
    });
    expect(state.stage).toBe("IN_TRANSIT");
    expect(state.milestones.depositPaid).toBe(true);
  });

  it("FINAL_PAYMENT when the invoice is paid before goods arrive", () => {
    const state = computeShipmentState({
      ...base,
      supplierInvoice: { status: "PAID", payments: [{ id: "p1" }] },
    });
    expect(state.stage).toBe("FINAL_PAYMENT");
    expect(state.milestones.finalPaid).toBe(true);
  });

  it("RECEIVING when a linked PO has been received but no landed cost", () => {
    const state = computeShipmentState({
      ...base,
      supplierInvoice: { status: "PAID", payments: [{ id: "p1" }] },
      purchaseOrders: [{ status: "PARTIALLY_RECEIVED" }],
    });
    expect(state.stage).toBe("RECEIVING");
  });

  it("LANDED_COST once landed cost work has started", () => {
    const state = computeShipmentState({
      ...base,
      purchaseOrders: [{ status: "FULLY_RECEIVED" }],
      landedCost: { status: "DRAFT" },
      supplierInvoice: { status: "PAID", payments: [{ id: "p1" }] },
    });
    expect(state.stage).toBe("LANDED_COST");
  });

  it("COMPLETED when received, paid, and landed cost posted", () => {
    const state = computeShipmentState({
      ...base,
      supplierInvoice: { status: "PAID", payments: [{ id: "p1" }] },
      landedCost: { status: "POSTED" },
      purchaseOrders: [{ status: "FULLY_RECEIVED" }],
    });
    expect(state.stage).toBe("COMPLETED");
    expect(state.stageIndex).toBe(IMPORT_SHIPMENT_STAGES.length - 1);
  });

  it("supports multiple purchase orders (future-proof relationship)", () => {
    const state = computeShipmentState({
      ...base,
      supplierInvoice: { status: "PAID", payments: [{ id: "p1" }] },
      landedCost: { status: "POSTED" },
      purchaseOrders: [{ status: "FULLY_RECEIVED" }, { status: "PARTIALLY_RECEIVED" }],
    });
    expect(state.milestones.goodsReceived).toBe(true);
    expect(state.stage).toBe("COMPLETED");
  });

  it("documents: reports required vs attached and contributes to progress", () => {
    const allDocs = REQUIRED_ATTACHMENT_TYPES.map((t) => ({ attachmentType: t }));
    const state = computeShipmentState({
      ...base,
      attachments: allDocs,
      supplierInvoice: { status: "PAID", payments: [{ id: "p1" }] },
      landedCost: { status: "POSTED" },
      purchaseOrders: [{ status: "FULLY_RECEIVED" }],
    });
    expect(state.documents.attached).toHaveLength(REQUIRED_ATTACHMENT_TYPES.length);
    expect(state.progress).toBe(100);
  });

  it("documents: missing docs cap progress below 100%", () => {
    const state = computeShipmentState({
      ...base,
      attachments: [{ attachmentType: "PROFORMA" }],
      supplierInvoice: { status: "PAID", payments: [{ id: "p1" }] },
      landedCost: { status: "POSTED" },
      purchaseOrders: [{ status: "FULLY_RECEIVED" }],
    });
    expect(state.documents.attached).toEqual(["PROFORMA"]);
    expect(state.progress).toBeGreaterThan(0);
    expect(state.progress).toBeLessThan(100);
  });

  it("documents: only the four required types are required; insurance is optional", () => {
    expect(REQUIRED_ATTACHMENT_TYPES).toEqual([
      "PROFORMA",
      "COMMERCIAL_INVOICE",
      "PACKING_LIST",
      "BILL_OF_LADING",
    ]);
    expect(OPTIONAL_ATTACHMENT_TYPES).toContain("INSURANCE");
    expect(OPTIONAL_ATTACHMENT_TYPES).toContain("PAYMENT_RECEIPT");
    expect(OPTIONAL_ATTACHMENT_TYPES).toContain("OTHER");
  });

  it("documents: insurance alone does not satisfy the required documents", () => {
    const state = computeShipmentState({
      ...base,
      attachments: [
        { attachmentType: "PROFORMA" },
        { attachmentType: "COMMERCIAL_INVOICE" },
        { attachmentType: "PACKING_LIST" },
        { attachmentType: "INSURANCE" },
      ],
    });
    expect(state.documents.attached).toEqual(["PROFORMA", "COMMERCIAL_INVOICE", "PACKING_LIST"]);
    expect(state.documents.required).toEqual(REQUIRED_ATTACHMENT_TYPES);
  });
});