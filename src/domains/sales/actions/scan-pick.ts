"use server";

import { BusinessError } from "@/shared/errors/business-error";

export async function scanPickAction() {
  throw new BusinessError(
    "Direct shipment scanning is deprecated. Use task line PATCH via the picking app instead.",
    "DEPRECATED_PATH",
  );
}
