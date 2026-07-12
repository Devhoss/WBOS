"use server";

import { mkdir, writeFile, unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

import { revalidatePath } from "next/cache";

import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { BusinessSettingsRepository } from "../repositories/business-settings-repository";

export async function uploadLogoAction(formData: FormData) {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();

    if (!new Set(["OWNER", "ADMIN", "MANAGER"]).has(context.role)) {
      throw new BusinessError("You do not have permission to update settings.", "FORBIDDEN");
    }

    const file = formData.get("logo") as File | null;

    if (!file) {
      return { ok: false, message: "No file provided." };
    }

    if (!file.type.startsWith("image/")) {
      return { ok: false, message: "File must be an image." };
    }

    if (file.size > 2 * 1024 * 1024) {
      return { ok: false, message: "File must be smaller than 2MB." };
    }

    const ext = file.name.split(".").pop() ?? "png";
    const dir = join(process.cwd(), "public", "uploads", `org-${context.organizationId}`);

    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    const oldSettings = await new BusinessSettingsRepository().findByOrganizationId(context.organizationId);

    if (oldSettings?.logoPath) {
      const oldPath = join(process.cwd(), "public", oldSettings.logoPath);
      if (existsSync(oldPath)) {
        await unlink(oldPath);
      }
    }

    const filename = `logo.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(join(dir, filename), buffer);

    const logoPath = `uploads/org-${context.organizationId}/${filename}`;
    await new BusinessSettingsRepository().updateForOrganization(context.organizationId, { logoPath });

    revalidatePath("/settings");

    return { ok: true, logoPath };
  } catch (error) {
    if (error instanceof BusinessError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}
