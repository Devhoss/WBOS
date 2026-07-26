import { prisma } from "@/infrastructure/database/prisma";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { AppShell } from "@/components/app-shell";
import { QuotationForm } from "./quotation-form";

export default async function NewQuotationPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const orgId = context.organizationId;

  const [customers, products, units] = await Promise.all([
    prisma.customer.findMany({
      where: { organizationId: orgId, archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { organizationId: orgId, archivedAt: null, status: { not: "ARCHIVED" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, barcode: true, defaultSellingPrice: true, unitOfMeasure: { select: { id: true, name: true, code: true } }, piecesPerBox: true },
    }).then((rows) => rows.map((p) => ({ ...p, defaultSellingPrice: p.defaultSellingPrice ? Number(p.defaultSellingPrice) : null, piecesPerBox: p.piecesPerBox ? Number(p.piecesPerBox) : null }))),
    prisma.unitOfMeasure.findMany({
      where: { organizationId: orgId, archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
  ]);

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">New Quotation</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create a commercial document to send to a customer.</p>
        </div>
        <QuotationForm customers={customers} products={products} unitsOfMeasure={units} />
      </div>
    </AppShell>
  );
}
