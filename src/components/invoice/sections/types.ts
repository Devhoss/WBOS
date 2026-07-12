import type { BrandingData, LanguageMode } from "@/components/document-engine";

export type InvoiceLine = {
  lineNumber: number;
  productName: string;
  productSku: string;
  unitOfMeasureCode: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  totalPrice: number;
  piecesPerBox: number | null;
};

export type InvoiceData = {
  id: string;
  invoiceNumber: string;
  status: string;
  currency: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  discountAmount: number;
  discountType: string | null;
  discountRate: number | null;
  amountPaid: number;
  issuedAt: string | null;
  dueDate: string | null;
  customerName: string;
  customerAddress: string | null;
  paymentTerms: string | null;
  notes: string | null;
  warehouseName: string | null;
  deliveryStatus: string | null;
  liveDeliveryStatus?: string | null;
  latestShipmentNumber?: string | null;
  salesOrder: { soNumber: string };
  lines: InvoiceLine[];
};

export type SectionProps = {
  branding: BrandingData;
  invoice: InvoiceData;
  language: LanguageMode;
  isRtl: boolean;
};
