import { NextRequest, NextResponse } from "next/server";

import { ProofOfDeliveryService } from "@/domains/sales/services/proof-of-delivery-service";
import { POD_MAX_BYTES } from "@/domains/sales/proof-of-delivery";
import { accountRateLimitOrNull } from "@/infrastructure/rate-limit/enforce";
import { apiContext } from "@/infrastructure/request/api-context";
import { BusinessError } from "@/shared/errors/business-error";

/** Maps a domain refusal to the status that describes it. */
function statusFor(code: string | undefined): number {
  switch (code) {
    case "DELIVERY_NOT_FOUND":
    case "POD_NOT_FOUND":
      return 404;
    case "POD_LIMIT_REACHED":
      return 409;
    default:
      return 400;
  }
}

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof BusinessError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: statusFor(error.code) },
    );
  }
  throw error;
}

/** The ordered set for one delivery. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shipmentId: string }> },
) {
  const auth = await apiContext(req.headers);
  if (!auth.ok) return auth.response;

  const { shipmentId } = await params;

  try {
    const documents = await new ProofOfDeliveryService().listForDelivery(auth.context, shipmentId);
    return NextResponse.json({ data: documents });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * Add one page.
 *
 * One file per request rather than a batch. The phone uploads pages
 * concurrently and needs to retry exactly the one that failed — a batch would
 * make a single dropped page re-send the ones that already succeeded, which is
 * the behaviour the requirements rule out.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shipmentId: string }> },
) {
  const auth = await apiContext(req.headers);
  if (!auth.ok) return auth.response;

  const limited = accountRateLimitOrNull(auth.context.userId, "pod-upload");
  if (limited) return limited;

  const { shipmentId } = await params;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Malformed upload." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  // Checked before the body is buffered so an oversized file is refused
  // without first being read into memory.
  if (file.size > POD_MAX_BYTES) {
    return NextResponse.json(
      { error: `Each document must be under ${Math.floor(POD_MAX_BYTES / (1024 * 1024))} MB.` },
      { status: 400 },
    );
  }

  try {
    const data = Buffer.from(await file.arrayBuffer());
    const result = await new ProofOfDeliveryService().upload(auth.context, {
      shipmentId,
      fileName: file.name || "proof-of-delivery",
      mimeType: file.type,
      data,
    });

    // 200 rather than 201 for a duplicate: nothing was created, and the client
    // uses the flag to report "already uploaded" instead of a second page.
    return NextResponse.json(
      { data: result.document, duplicate: result.duplicate },
      { status: result.duplicate ? 200 : 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** Rewrite page order. Body: `{ documentIds: string[] }`, in the new order. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ shipmentId: string }> },
) {
  const auth = await apiContext(req.headers);
  if (!auth.ok) return auth.response;

  const limited = accountRateLimitOrNull(auth.context.userId, "pod-mutate");
  if (limited) return limited;

  const { shipmentId } = await params;

  let body: { documentIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const documentIds = body.documentIds;
  if (!Array.isArray(documentIds) || documentIds.some((id) => typeof id !== "string")) {
    return NextResponse.json({ error: "documentIds must be an array of ids." }, { status: 400 });
  }

  try {
    const documents = await new ProofOfDeliveryService().reorder(
      auth.context,
      shipmentId,
      documentIds as string[],
    );
    return NextResponse.json({ data: documents });
  } catch (error) {
    return toErrorResponse(error);
  }
}
