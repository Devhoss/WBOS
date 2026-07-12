import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { CustomerRepository } from "@/domains/customers/repositories/customer-repository";
import { ProductService } from "@/domains/products/services/product-service";
import { SalesOrderRepository } from "@/domains/sales/repositories/sales-order-repository";
import { UnitOfMeasureRepository } from "@/domains/units/repositories/unit-of-measure-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

import { EditSalesOrderForm } from "./edit-sales-order-form";

export async function generateMetadata({ params }: { params: Promise<{ soId: string }> }): Promise<Metadata> {
  const { soId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const order = await new SalesOrderRepository().findById(context.organizationId, soId);

  if (!order) {
    return { title: "Not Found" };
  }

  return { title: `Edit ${order.soNumber}` };
}

export default async function EditSalesOrderPage({ params }: { params: Promise<{ soId: string }> }) {
  const { soId } = await params;
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const [order, products, customers, units] = await Promise.all([
    new SalesOrderRepository().findById(context.organizationId, soId),
    new ProductService().listForCatalog(context),
    new CustomerRepository().listActive(context.organizationId),
    new UnitOfMeasureRepository().listActive(context.organizationId),
  ]);

  if (!order) notFound();

  const activeProducts = products.filter((p) => p.status === "ACTIVE" && !p.archivedAt);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <h1 className="text-2xl font-semibold tracking-normal">Edit {order.soNumber}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Changes are only allowed while the order is in Draft status.</p>
        </div>
        <EditSalesOrderForm
          order={{
            id: order.id, soNumber: order.soNumber, customerId: order.customerId,
            currency: order.currency, subtotal: Number(order.subtotal).toFixed(3),
            taxAmount: Number(order.taxAmount).toFixed(3), totalAmount: Number(order.totalAmount).toFixed(3),
            discountAmount: Number(order.discountAmount).toFixed(3),
            discountType: order.discountType,
            discountRate: order.discountRate ? Number(order.discountRate).toFixed(3) : null,
            expectedShipDate: order.expectedShipDate ? order.expectedShipDate.toISOString().split("T")[0] : "",
            deliveryAddress: order.deliveryAddress ?? "", notes: order.notes ?? "",
            internalNotes: order.internalNotes ?? "", customerReference: order.customerReference ?? "",
            lines: order.lines.map((l) => ({
              id: l.id, productId: l.productId, unitOfMeasureId: l.unitOfMeasureId,
              orderedQuantity: String(l.orderedQuantity), unitPrice: String(l.unitPrice),
              totalPrice: String(l.totalPrice), productName: l.productName, productSku: l.productSku,
              unitOfMeasureCode: l.unitOfMeasureCode,
              piecesPerBox: l.piecesPerBox ? String(l.piecesPerBox) : "",
              description: l.description ?? "", notes: l.notes ?? "",
            })),
          }}
          products={activeProducts.map((p) => ({
            id: p.id, sku: p.sku, name: p.name, defaultSellingPrice: Number(p.defaultSellingPrice ?? 0),
            unitOfMeasureId: p.unitOfMeasureId, unitOfMeasureCode: p.unitOfMeasure.code,
          }))}
          customers={customers.map((c) => ({ id: c.id, name: c.name, code: c.code }))}
          units={units.map((u) => ({ id: u.id, name: u.name, code: u.code }))}
        />
      </div>
    </AppShell>
  );
}
