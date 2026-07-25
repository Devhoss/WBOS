-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('PICK_ORDER', 'GOODS_RECEIPT', 'CYCLE_COUNT', 'INVENTORY_TRANSFER', 'DELIVERY');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TaskLineStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "TaskReferenceType" AS ENUM ('SALES_ORDER', 'PURCHASE_ORDER', 'CYCLE_COUNT', 'INVENTORY_TRANSFER');

-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'TSK';

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taskNumber" TEXT NOT NULL,
    "type" "TaskType" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'ASSIGNED',
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "referenceType" "TaskReferenceType" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "data" JSONB,
    "dueAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_lines" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "referenceLineId" TEXT NOT NULL,
    "completedQuantity" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "status" "TaskLineStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "task_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tasks_organizationId_type_idx" ON "tasks"("organizationId", "type");

-- CreateIndex
CREATE INDEX "tasks_organizationId_status_idx" ON "tasks"("organizationId", "status");

-- CreateIndex
CREATE INDEX "tasks_organizationId_referenceType_referenceId_idx" ON "tasks"("organizationId", "referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "tasks_organizationId_assignedToId_status_idx" ON "tasks"("organizationId", "assignedToId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_organizationId_taskNumber_key" ON "tasks"("organizationId", "taskNumber");

-- CreateIndex
CREATE INDEX "task_lines_taskId_idx" ON "task_lines"("taskId");

-- CreateIndex
CREATE INDEX "task_lines_organizationId_referenceLineId_idx" ON "task_lines"("organizationId", "referenceLineId");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_lines" ADD CONSTRAINT "task_lines_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_lines" ADD CONSTRAINT "task_lines_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
