"use server";

import { BusinessError } from "@/shared/errors/business-error";

export async function manualPickAction() {
  throw new BusinessError(
    "Direct shipment picking is deprecated. Use task line PATCH via the picking app instead.",
    "DEPRECATED_PATH",
  );
}
