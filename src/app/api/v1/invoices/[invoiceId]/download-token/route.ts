import { NextRequest, NextResponse } from "next/server";

import { InvoiceRepository } from "@/domains/sales/repositories/invoice-repository";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { generateDownloadToken } from "@/lib/download/signed-token";
import { BusinessError } from "@/shared/errors/business-error";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  try {
    const { invoiceId } = await params;
    const context = await new AuthenticatedRequestContextService().getCurrentContext(req.headers);

    const invoice = await new InvoiceRepository().findById(context.organizationId, invoiceId);
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const token = generateDownloadToken(invoiceId, context.organizationId);
    const baseUrl = (process.env.BETTER_AUTH_URL ?? process.env.INTERNAL_APP_URL ?? "").replace(/\/+$/, "");
    const url = `${baseUrl}/api/invoices/download/${token}`;

    return NextResponse.json({ url, expiresIn: 300 });
  } catch (error) {
    if (error instanceof BusinessError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Download token generation failed:", error);
    return NextResponse.json({ error: "Failed to generate download URL" }, { status: 500 });
  }
}
