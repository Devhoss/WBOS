import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { ProductService } from "@/domains/products/services/product-service";
import { PurchaseOrderRepository } from "@/domains/purchasing/repositories/purchase-order-repository";
import { SupplierRepository } from "@/domains/suppliers/repositories/supplier-repository";
import { UnitOfMeasureRepository } from "@/domains/units/repositories/unit-of-measure-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { EditPurchaseOrderForm } from "./edit-purchase-order-form";

export async function generateMetadata({ params }: { params: Promise<{ poId: string }> }): Promise<Metadata> {
  const { poId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const order = await new PurchaseOrderRepository().findById(context.organizationId, poId);

  if (!order) {
    return { title: "Not Found" };
  }

  return { title: `Edit ${order.poNumber}` };
}

export default async function EditPurchaseOrderPage({
  params,
}: {
  params: Promise<{ poId: string }>;
}) {
  const { poId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const [order, products, suppliers, units] = await Promise.all([
    new PurchaseOrderRepository().findById(context.organizationId, poId),
    new ProductService().listForCatalog(context),
    new SupplierRepository().listActive(context.organizationId),
    new UnitOfMeasureRepository().listActive(context.organizationId),
  ]);

  if (!order) {
    notFound();
  }

  const activeProducts = products.filter(
    (product) => product.status === "ACTIVE" && !product.archivedAt,
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">
            Edit {order.poNumber}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Modify the purchase order. Changes are only allowed while the order is in Draft status.
          </p>
        </div>

        <EditPurchaseOrderForm
          order={{
            id: order.id,
            poNumber: order.poNumber,
            supplierId: order.supplierId,
            currency: order.currency,
            subtotal: Number(order.subtotal).toFixed(3),
            taxAmount: Number(order.taxAmount).toFixed(3),
            totalAmount: Number(order.totalAmount).toFixed(3),
            expectedDeliveryDate: order.expectedDeliveryDate
              ? order.expectedDeliveryDate.toISOString().split("T")[0]
              : "",
            deliveryAddress: order.deliveryAddress ?? "",
            notes: order.notes ?? "",
            internalNotes: order.internalNotes ?? "",
            lines: order.lines.map((line) => ({
              id: line.id,
              productId: line.productId,
              unitOfMeasureId: line.unitOfMeasureId,
              orderedQuantity: String(line.orderedQuantity),
              unitCost: String(line.unitCost),
              totalCost: String(line.totalCost),
              description: line.description ?? "",
              notes: line.notes ?? "",
            })),
          }}
          products={activeProducts.map((p) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
          }))}
          suppliers={suppliers.map((s) => ({
            id: s.id,
            name: s.name,
          }))}
          units={units.map((u) => ({
            id: u.id,
            name: u.name,
            code: u.code,
          }))}
        />
      </div>
    </AppShell>
  );
}
