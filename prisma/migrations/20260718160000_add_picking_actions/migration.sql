CREATE TABLE "picking_actions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "taskLineId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "shipmentLineId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "delta" DECIMAL(18,6) NOT NULL,
    "clientEventId" TEXT NOT NULL,
    "deviceId" TEXT,
    "status" TEXT NOT NULL,
    "resultingQuantity" DECIMAL(18,6) NOT NULL,
    "scannedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "picking_actions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "picking_actions_organizationId_clientEventId_key" ON "picking_actions"("organizationId", "clientEventId");
CREATE INDEX "picking_actions_organizationId_taskId_taskLineId_idx" ON "picking_actions"("organizationId", "taskId", "taskLineId");
CREATE INDEX "picking_actions_organizationId_shipmentId_shipmentLineId_idx" ON "picking_actions"("organizationId", "shipmentId", "shipmentLineId");
