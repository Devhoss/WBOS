import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import { DocumentNumberService } from "@/domains/documents/services/document-number-service";
import { SupplierRepository } from "@/domains/suppliers/repositories/supplier-repository";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { ImportShipmentRepository } from "../repositories/import-shipment-repository";
import type {
  CreateImportShipmentInput,
  LinkLandedCostInput,
  LinkPurchaseOrderInput,
  LinkSupplierInvoiceInput,
  UpdateImportShipmentInput,
} from "../validation/import-shipment-schema";

export class ImportShipmentService {
  constructor(
    private readonly shipments = new ImportShipmentRepository(),
    private readonly suppliers = new SupplierRepository(),
    private readonly documents = new DocumentNumberService(),
    private readonly activityLogs = new ActivityLogRepository(),
  ) {}

  async create(context: AuthenticatedRequestContext, input: CreateImportShipmentInput) {
    const supplier = await this.suppliers.findById(context.organizationId, input.supplierId);
    if (!supplier) {
      throw new BusinessError("Supplier was not found.", "IMPORT_SHIPMENT_SUPPLIER_NOT_FOUND");
    }
    if (supplier.archivedAt) {
      throw new BusinessError("Supplier is archived.", "IMPORT_SHIPMENT_SUPPLIER_ARCHIVED");
    }

    const now = new Date();
    const { documentNumber } = await this.documents.generate({
      organizationId: context.organizationId,
      documentType: "IMP",
      year: now.getFullYear(),
      prefix: "IMP",
    });

    const shipment = await this.shipments.create(context.organizationId, documentNumber, context.userId, input);

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "IMPORT_SHIPMENT_CREATED",
      entityType: "ImportShipment",
      entityId: shipment.id,
      summary: `Import shipment ${documentNumber} was created.`,
      metadata: { shipmentNumber: documentNumber, supplierId: input.supplierId },
    });

    return shipment;
  }

  async update(context: AuthenticatedRequestContext, input: UpdateImportShipmentInput) {
    const shipment = await this.shipments.findById(context.organizationId, input.id);
    if (!shipment) {
      throw new BusinessError("Import shipment was not found.", "IMPORT_SHIPMENT_NOT_FOUND");
    }
    if (shipment.archivedAt) {
      throw new BusinessError("Import shipment is archived.", "IMPORT_SHIPMENT_ARCHIVED");
    }

    const updated = await this.shipments.update(context.organizationId, input.id, input);

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "IMPORT_SHIPMENT_UPDATED",
      entityType: "ImportShipment",
      entityId: shipment.id,
      summary: `Import shipment ${shipment.shipmentNumber} was updated.`,
      metadata: { shipmentNumber: shipment.shipmentNumber },
    });

    return updated;
  }

  async linkPurchaseOrder(context: AuthenticatedRequestContext, input: LinkPurchaseOrderInput) {
    const shipment = await this.getActiveShipment(context, input.importShipmentId);
    const purchaseOrder = await this.shipments.findPurchaseOrderSummary(
      context.organizationId,
      input.purchaseOrderId,
    );

    if (!purchaseOrder) {
      throw new BusinessError("Purchase order was not found.", "IMPORT_SHIPMENT_PO_NOT_FOUND");
    }
    if (purchaseOrder.archivedAt) {
      throw new BusinessError("Purchase order is archived.", "IMPORT_SHIPMENT_PO_ARCHIVED");
    }
    if (purchaseOrder.supplierId !== shipment.supplierId) {
      throw new BusinessError(
        "Purchase order belongs to a different supplier.",
        "IMPORT_SHIPMENT_SUPPLIER_MISMATCH",
      );
    }
    const existing = await this.shipments.findLinkByPurchaseOrder(
      context.organizationId,
      input.purchaseOrderId,
    );
    if (existing) {
      throw new BusinessError(
        "Purchase order is already linked to an import shipment.",
        "IMPORT_SHIPMENT_PO_ALREADY_LINKED",
      );
    }

    await this.shipments.linkPurchaseOrder(context.organizationId, shipment.id, purchaseOrder.id);

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "IMPORT_SHIPMENT_PO_LINKED",
      entityType: "ImportShipment",
      entityId: shipment.id,
      summary: `Purchase order ${purchaseOrder.poNumber} linked to import shipment ${shipment.shipmentNumber}.`,
      metadata: { shipmentNumber: shipment.shipmentNumber, purchaseOrderId: purchaseOrder.id },
    });

    return this.refresh(context, shipment.id);
  }

  async unlinkPurchaseOrder(context: AuthenticatedRequestContext, input: LinkPurchaseOrderInput) {
    const shipment = await this.getActiveShipment(context, input.importShipmentId);
    await this.shipments.unlinkPurchaseOrder(context.organizationId, shipment.id, input.purchaseOrderId);

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "IMPORT_SHIPMENT_PO_UNLINKED",
      entityType: "ImportShipment",
      entityId: shipment.id,
      summary: `Purchase order removed from import shipment ${shipment.shipmentNumber}.`,
      metadata: { shipmentNumber: shipment.shipmentNumber, purchaseOrderId: input.purchaseOrderId },
    });

    return this.refresh(context, shipment.id);
  }

  async linkSupplierInvoice(context: AuthenticatedRequestContext, input: LinkSupplierInvoiceInput) {
    const shipment = await this.getActiveShipment(context, input.importShipmentId);
    const invoice = await this.shipments.findSupplierInvoiceSummary(
      context.organizationId,
      input.supplierInvoiceId,
    );

    if (!invoice) {
      throw new BusinessError("Supplier invoice was not found.", "IMPORT_SHIPMENT_SI_NOT_FOUND");
    }
    if (invoice.archivedAt) {
      throw new BusinessError("Supplier invoice is archived.", "IMPORT_SHIPMENT_SI_ARCHIVED");
    }
    if (invoice.supplierId !== shipment.supplierId) {
      throw new BusinessError(
        "Supplier invoice belongs to a different supplier.",
        "IMPORT_SHIPMENT_SUPPLIER_MISMATCH",
      );
    }

    await this.shipments.setSupplierInvoice(context.organizationId, shipment.id, invoice.id);

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "IMPORT_SHIPMENT_SI_LINKED",
      entityType: "ImportShipment",
      entityId: shipment.id,
      summary: `Supplier invoice ${invoice.siNumber} linked to import shipment ${shipment.shipmentNumber}.`,
      metadata: { shipmentNumber: shipment.shipmentNumber, supplierInvoiceId: invoice.id },
    });

    return this.refresh(context, shipment.id);
  }

  async linkLandedCost(context: AuthenticatedRequestContext, input: LinkLandedCostInput) {
    const shipment = await this.getActiveShipment(context, input.importShipmentId);
    const landedCost = await this.shipments.findLandedCostSummary(context.organizationId, input.landedCostId);

    if (!landedCost) {
      throw new BusinessError("Landed cost was not found.", "IMPORT_SHIPMENT_LC_NOT_FOUND");
    }
    if (landedCost.status === "CANCELLED") {
      throw new BusinessError("Landed cost is cancelled.", "IMPORT_SHIPMENT_LC_CANCELLED");
    }
    if (landedCost.supplierId && landedCost.supplierId !== shipment.supplierId) {
      throw new BusinessError(
        "Landed cost belongs to a different supplier.",
        "IMPORT_SHIPMENT_SUPPLIER_MISMATCH",
      );
    }

    await this.shipments.setLandedCost(context.organizationId, shipment.id, landedCost.id);

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "IMPORT_SHIPMENT_LC_LINKED",
      entityType: "ImportShipment",
      entityId: shipment.id,
      summary: `Landed cost ${landedCost.lcNumber} linked to import shipment ${shipment.shipmentNumber}.`,
      metadata: { shipmentNumber: shipment.shipmentNumber, landedCostId: landedCost.id },
    });

    return this.refresh(context, shipment.id);
  }

  async archive(context: AuthenticatedRequestContext, id: string) {
    const shipment = await this.shipments.findById(context.organizationId, id);
    if (!shipment) {
      throw new BusinessError("Import shipment was not found.", "IMPORT_SHIPMENT_NOT_FOUND");
    }
    if (shipment.archivedAt) {
      throw new BusinessError("Import shipment is already archived.", "IMPORT_SHIPMENT_ALREADY_ARCHIVED");
    }

    await this.shipments.archive(context.organizationId, id);

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "IMPORT_SHIPMENT_ARCHIVED",
      entityType: "ImportShipment",
      entityId: shipment.id,
      summary: `Import shipment ${shipment.shipmentNumber} was archived.`,
      metadata: { shipmentNumber: shipment.shipmentNumber },
    });
  }

  private async getActiveShipment(context: AuthenticatedRequestContext, id: string) {
    const shipment = await this.shipments.findById(context.organizationId, id);
    if (!shipment) {
      throw new BusinessError("Import shipment was not found.", "IMPORT_SHIPMENT_NOT_FOUND");
    }
    if (shipment.archivedAt) {
      throw new BusinessError("Import shipment is archived.", "IMPORT_SHIPMENT_ARCHIVED");
    }
    return shipment;
  }

  private async refresh(context: AuthenticatedRequestContext, id: string) {
    const shipment = await this.shipments.findById(context.organizationId, id);
    if (!shipment) {
      throw new BusinessError("Import shipment was not found.", "IMPORT_SHIPMENT_NOT_FOUND");
    }
    return shipment;
  }
}