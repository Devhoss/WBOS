import { NextResponse } from "next/server";

import { AttachmentService } from "@/domains/attachments/services/attachment-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    const { attachment, data } = await new AttachmentService().getFile(context, id);

    const body = new Uint8Array(data);

    return new NextResponse(body, {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Disposition": `inline; filename="${attachment.fileName.replace(/["\\]/g, "")}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    if (error instanceof BusinessError) {
      return new NextResponse(null, { status: 404 });
    }
    return new NextResponse(null, { status: 401 });
  }
}