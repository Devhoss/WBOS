type QtPdfLine = {
  lineNumber: number;
  productName: string;
  productArabicName: string | null;
  productBarcode: string | null;
  unitOfMeasureCode: string;
  piecesPerBox: number | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

type QtPdfData = {
  qtNumber: string;
  customerName: string;
  currency: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  notes: string | null;
  terms: string | null;
  issueDate: string;
  validUntil: string | null;
  lines: QtPdfLine[];
  businessName: string;
  arabicBusinessName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logoPath: string | null;
};

export function quotationPdfHtml(data: QtPdfData): string {
  const linesHtml = data.lines
    .map(
      (l) => `<tr>
        <td style="padding:4px;font-family:monospace;font-size:10px;color:#6b7280">${l.productBarcode ?? "—"}</td>
        <td style="padding:4px">${l.productName}${l.productArabicName ? `<br/><span style="font-size:10px;color:#9ca3af">${l.productArabicName}</span>` : ""}</td>
        <td style="padding:4px;text-align:center;font-size:10px;color:#6b7280">${l.unitOfMeasureCode}</td>
        <td style="padding:4px;text-align:center;font-family:monospace;font-size:10px;color:#6b7280">${l.piecesPerBox != null ? l.piecesPerBox.toFixed(0) : "—"}</td>
        <td style="padding:4px;text-align:right;font-family:monospace">${l.quantity.toFixed(3)}</td>
        <td style="padding:4px;text-align:right;font-family:monospace">${l.unitPrice.toFixed(3)}</td>
        <td style="padding:4px;text-align:right;font-family:monospace;font-weight:600">${l.totalPrice.toFixed(3)}</td>
      </tr>`,
    )
    .join("");

  const dateStr = new Date(data.issueDate).toLocaleDateString();
  const validUntilStr = data.validUntil
    ? `<div><span style="font-weight:600">Valid Until:</span> ${new Date(data.validUntil).toLocaleDateString()}</div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { size: A4 portrait; margin: 12mm 15mm; }
    body { font-family: 'Noto Sans Arabic', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 1.5; color: #1a1a1a; margin: 0; padding: 12mm 15mm; }
    table { page-break-inside: avoid; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      ${data.logoPath ? `<img src="${data.logoPath}" style="max-height:60px;margin-bottom:8px" />` : ""}
      <h1 style="font-size:20px;font-weight:700;margin:0">${data.businessName}</h1>
      ${data.arabicBusinessName ? `<p style="margin:4px 0 0;font-size:14px;color:#6b7280">${data.arabicBusinessName}</p>` : ""}
      ${data.address ? `<p style="margin:2px 0;font-size:11px;color:#6b7280">${data.address}</p>` : ""}
      ${data.phone ? `<p style="margin:2px 0;font-size:11px;color:#6b7280">${data.phone}</p>` : ""}
      ${data.email ? `<p style="margin:2px 0;font-size:11px;color:#6b7280">${data.email}</p>` : ""}
    </div>
    <div style="text-align:right">
      <h1 style="font-size:20px;font-weight:700;margin:0">${data.qtNumber}</h1>
      <p style="margin:4px 0 0;font-size:13px;color:#6b7280">${data.customerName}</p>
    </div>
  </div>

  <div style="display:flex;gap:24px;font-size:12px;color:#4b5563;margin-top:16px">
    <div><span style="font-weight:600">Date:</span> ${dateStr}</div>
    ${validUntilStr}
    <div><span style="font-weight:600">Currency:</span> ${data.currency}</div>
  </div>

  <div style="border-top:1px solid #d1d5db;margin-top:16px"></div>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:8px">
    <thead>
      <tr style="border-bottom:2px solid #d1d5db">
        <th style="padding:6px 4px;text-align:left;font-weight:600;color:#4b5563">Barcode</th>
        <th style="padding:6px 4px;text-align:left;font-weight:600;color:#4b5563">Product</th>
        <th style="padding:6px 4px;text-align:center;font-weight:600;color:#4b5563">UOM</th>
        <th style="padding:6px 4px;text-align:center;font-weight:600;color:#4b5563">PC/CTN</th>
        <th style="padding:6px 4px;text-align:right;font-weight:600;color:#4b5563">Qty</th>
        <th style="padding:6px 4px;text-align:right;font-weight:600;color:#4b5563">Unit Price</th>
        <th style="padding:6px 4px;text-align:right;font-weight:600;color:#4b5563">Total</th>
      </tr>
    </thead>
    <tbody>
      ${linesHtml}
    </tbody>
  </table>

  <div style="border-top:1px solid #d1d5db;padding-top:12px;display:flex;flex-direction:column;align-items:flex-end;gap:4px;font-size:12px;margin-top:8px">
    ${data.discountAmount > 0 ? `<div style="display:flex;gap:40px"><span>Subtotal</span><span style="font-family:monospace;min-width:80px;text-align:right">${data.subtotal.toFixed(3)}</span></div>` : ""}
    <div style="display:flex;gap:40px">
      <span style="font-weight:600">Total</span>
      <span style="font-family:monospace;font-weight:700;font-size:14px;min-width:80px;text-align:right">${data.currency} ${data.totalAmount.toFixed(3)}</span>
    </div>
  </div>

  ${data.notes ? `<div style="font-size:12px;color:#4b5563;border-top:1px solid #d1d5db;padding-top:12px;margin-top:12px"><div style="font-weight:600;margin-bottom:4px">Notes</div><div style="white-space:pre-wrap">${data.notes}</div></div>` : ""}

  ${data.terms ? `<div style="font-size:12px;color:#4b5563;border-top:1px solid #d1d5db;padding-top:12px;margin-top:12px"><div style="font-weight:600;margin-bottom:4px">Terms</div><div style="white-space:pre-wrap">${data.terms}</div></div>` : ""}
</body>
</html>`;
}
