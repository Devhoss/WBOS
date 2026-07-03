-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "paymentTerms" TEXT,
    "creditLimit" DECIMAL(18,3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customers_organizationId_archivedAt_idx" ON "customers"("organizationId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "customers_organizationId_name_key" ON "customers"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "customers_organizationId_code_key" ON "customers"("organizationId", "code");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
