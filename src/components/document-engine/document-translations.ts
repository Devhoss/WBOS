export type LanguageMode = "english" | "arabic" | "bilingual";

type TranslationEntry = { en: string; ar: string };

const translations: Record<string, TranslationEntry> = {
  invoice: { en: "Invoice", ar: "فاتورة" },
  invoiceNumber: { en: "Invoice No.", ar: "رقم الفاتورة" },
  salesOrder: { en: "Sales Order", ar: "أمر البيع" },
  shipment: { en: "Shipment", ar: "الشحنة" },
  purchaseOrder: { en: "Purchase Order", ar: "أمر الشراء" },
  goodsReceipt: { en: "Goods Receipt Note", ar: "إشعار استلام البضائع" },
  deliveryNote: { en: "Delivery Note", ar: "إشعار التسليم" },
  creditNote: { en: "Credit Note", ar: "إشعار دائن" },
  returns: { en: "Returns", ar: "المرتجعات" },
  date: { en: "Date", ar: "التاريخ" },
  dueDate: { en: "Due Date", ar: "تاريخ الاستحقاق" },
  customer: { en: "Customer", ar: "العميل" },
  supplier: { en: "Supplier", ar: "المورد" },
  salesperson: { en: "Salesperson", ar: "مندوب المبيعات" },
  deliveryPerson: { en: "Delivery Person", ar: "مندوب التسليم" },
  product: { en: "Product", ar: "المنتج" },
  quantity: { en: "Qty", ar: "الكمية" },
  netPrice: { en: "Net Price", ar: "السعر الكلي" },
  unit: { en: "Unit", ar: "الوحدة" },
  unitPrice: { en: "Unit Price", ar: "سعر الوحدة" },
  discount: { en: "Discount", ar: "الخصم" },
  total: { en: "Total", ar: "الإجمالي" },
  subtotal: { en: "Subtotal", ar: "المجموع الفرعي" },
  tax: { en: "Tax", ar: "الضريبة" },
  vatNumber: { en: "VAT No.", ar: "رقم ضريبة القيمة المضافة" },
  commercialRegistration: { en: "C.R. No.", ar: "رقم السجل التجاري" },
  notes: { en: "Notes", ar: "ملاحظات" },
  termsAndConditions: { en: "Terms & Conditions", ar: "الشروط والأحكام" },
  customerSignature: { en: "Customer Signature", ar: "توقيع العميل" },
  driverSignature: { en: "Driver Signature", ar: "توقيع مندوب التسليم" },
  authorizedSignature: { en: "Authorized Signature", ar: "التوقيع المعتمد" },
  page: { en: "Page", ar: "صفحة" },
  phone: { en: "Phone", ar: "الهاتف" },
  email: { en: "Email", ar: "البريد الإلكتروني" },
  website: { en: "Website", ar: "الموقع الإلكتروني" },
  currency: { en: "Currency", ar: "العملة" },
  line: { en: "No.", ar: "رقم" },
  amount: { en: "Amount", ar: "المبلغ" },
  paid: { en: "Paid", ar: "المدفوع" },
  balance: { en: "Balance", ar: "الرصيد" },
  paymentTerms: { en: "Payment Terms", ar: "شروط الدفع" },
  status: { en: "Status", ar: "الحالة" },
  issuedAt: { en: "Issued Date", ar: "تاريخ الإصدار" },
  company: { en: "Company", ar: "الشركة" },
  address: { en: "Address", ar: "العنوان" },
  description: { en: "Description", ar: "الوصف" },
  reference: { en: "Reference", ar: "المرجع" },
  piecesPerBox: { en: "PC", ar: "شد" },
  warehouse: { en: "Warehouse", ar: "المستودع" },
  deliveryStatus: { en: "Delivery Status", ar: "حالة التسليم" },
  customerNotes: { en: "Customer Notes", ar: "ملاحظات العميل" },
  signature: { en: "Signature", ar: "التوقيع" },
  discountType: { en: "Discount Type", ar: "نوع الخصم" },
  box: { en: "Box", ar: "كرتونة" },
  scanMe: { en: "Scan Me", ar: "امسحني" },
};

export function t(label: string, mode: LanguageMode): string {
  const entry = translations[label];
  if (!entry) return label;
  if (mode === "english") return entry.en;
  if (mode === "arabic") return entry.ar;
  return `${entry.en} / ${entry.ar}`;
}

export function tLabel(label: string, mode: LanguageMode): { en: string; ar: string; combined: string } {
  const entry = translations[label];
  if (!entry) return { en: label, ar: label, combined: label };
  const en = entry.en;
  const ar = entry.ar;
  if (mode === "english") return { en, ar, combined: en };
  if (mode === "arabic") return { en, ar, combined: ar };
  return { en, ar, combined: `${en} / ${ar}` };
}
