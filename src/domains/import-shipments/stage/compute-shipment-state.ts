import type { AttachmentType } from "@prisma/client";

export const IMPORT_SHIPMENT_STAGES = [
  "PLANNING",
  "DEPOSIT_PAID",
  "FINAL_PAYMENT",
  "IN_TRANSIT",
  "RECEIVING",
  "LANDED_COST",
  "COMPLETED",
] as const;

export type ImportShipmentStage = (typeof IMPORT_SHIPMENT_STAGES)[number];

export const REQUIRED_ATTACHMENT_TYPES: AttachmentType[] = [
  "PROFORMA",
  "COMMERCIAL_INVOICE",
  "PACKING_LIST",
  "BILL_OF_LADING",
];

export const OPTIONAL_ATTACHMENT_TYPES: AttachmentType[] = [
  "INSURANCE",
  "PAYMENT_RECEIPT",
  "OTHER",
];

export type DerivedShipmentState = {
  stage: ImportShipmentStage;
  stageIndex: number;
  progress: number;
  milestones: {
    depositPaid: boolean;
    finalPaid: boolean;
    receivingStarted: boolean;
    goodsReceived: boolean;
    landedCostPosted: boolean;
  };
  documents: {
    required: AttachmentType[];
    attached: AttachmentType[];
  };
  linked: {
    hasSupplierInvoice: boolean;
    hasLandedCost: boolean;
    hasPurchaseOrder: boolean;
  };
};

const STAGE_INDEX: Record<ImportShipmentStage, number> = {
  PLANNING: 0,
  DEPOSIT_PAID: 1,
  FINAL_PAYMENT: 2,
  IN_TRANSIT: 3,
  RECEIVING: 4,
  LANDED_COST: 5,
  COMPLETED: 6,
};

const STAGE_LIST = IMPORT_SHIPMENT_STAGES as readonly string[];

type ShipmentReading = {
  supplierInvoice: {
    status: string;
    payments: unknown[];
  } | null;
  landedCost: { status: string } | null;
  purchaseOrders: { status: string }[];
  attachments?: { attachmentType: AttachmentType }[];
};

export function computeShipmentState(reading: ShipmentReading): DerivedShipmentState {
  const hasDeposit = Boolean(reading.supplierInvoice && reading.supplierInvoice.payments.length > 0);
  const finalPaid = reading.supplierInvoice?.status === "PAID";
  const receivingStarted = reading.purchaseOrders.some(
    (po) => po.status === "PARTIALLY_RECEIVED" || po.status === "FULLY_RECEIVED",
  );
  const goodsReceived = reading.purchaseOrders.some((po) => po.status === "FULLY_RECEIVED");
  const landedCostPosted = reading.landedCost?.status === "POSTED";

  let stage: ImportShipmentStage;
  if (goodsReceived && finalPaid && landedCostPosted) {
    stage = "COMPLETED";
  } else if (receivingStarted && reading.landedCost) {
    stage = "LANDED_COST";
  } else if (receivingStarted) {
    stage = "RECEIVING";
  } else if (finalPaid) {
    stage = "FINAL_PAYMENT";
  } else if (hasDeposit) {
    stage = "IN_TRANSIT";
  } else {
    stage = "PLANNING";
  }

  const stageIndex = STAGE_INDEX[stage];

  const attachedTypes = reading.attachments?.map((a) => a.attachmentType) ?? [];
  const attached = REQUIRED_ATTACHMENT_TYPES.filter((t) => attachedTypes.includes(t));

  const workflowTerminals = 4;
  const workflowDone = [
    hasDeposit,
    finalPaid,
    receivingStarted,
    landedCostPosted,
  ].filter(Boolean).length;
  const documentFraction = REQUIRED_ATTACHMENT_TYPES.length > 0 ? attached.length / REQUIRED_ATTACHMENT_TYPES.length : 1;
  const progress = Math.round((workflowDone / workflowTerminals) * 80 + documentFraction * 20);

  return {
    stage,
    stageIndex,
    progress,
    milestones: { depositPaid: hasDeposit, finalPaid, receivingStarted, goodsReceived, landedCostPosted },
    documents: { required: REQUIRED_ATTACHMENT_TYPES, attached },
    linked: {
      hasSupplierInvoice: Boolean(reading.supplierInvoice),
      hasLandedCost: Boolean(reading.landedCost),
      hasPurchaseOrder: reading.purchaseOrders.length > 0,
    },
  };
}

export function stageLabel(stage: string): string {
  const map: Record<string, string> = {
    PLANNING: "Planning",
    DEPOSIT_PAID: "Deposit Paid",
    FINAL_PAYMENT: "Final Payment",
    IN_TRANSIT: "In Transit",
    RECEIVING: "Receiving",
    LANDED_COST: "Landed Cost",
    COMPLETED: "Completed",
  };
  return map[stage] ?? stage;
}

export function stageOrderIndexOf(stage: string): number {
  return STAGE_LIST.indexOf(stage);
}