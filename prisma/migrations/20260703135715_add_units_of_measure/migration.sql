-- CreateTable
CREATE TABLE "units_of_measure" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isBaseUnit" BOOLEAN NOT NULL DEFAULT false,
    "conversionToBase" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "units_of_measure_organizationId_archivedAt_idx" ON "units_of_measure"("organizationId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "units_of_measure_organizationId_name_key" ON "units_of_measure"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "units_of_measure_organizationId_code_key" ON "units_of_measure"("organizationId", "code");

-- AddForeignKey
ALTER TABLE "units_of_measure" ADD CONSTRAINT "units_of_measure_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
