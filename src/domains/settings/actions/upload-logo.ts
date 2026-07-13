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

    const storageRoot = process.env.WBOS_STORAGE_ROOT ?? join(process.cwd(), "public");
    const ext = file.name.split(".").pop() ?? "png";
    const dir = join(storageRoot, "uploads", `org-${context.organizationId}`);

    try {
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
    } catch (err) {
      console.error("[upload-logo] Failed to create upload directory", {
        storageRoot,
        targetDir: dir,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        uid: (process as any).getuid?.() ?? "N/A",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        gid: (process as any).getgid?.() ?? "N/A",
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        ok: false,
        message:
          "Upload directory could not be created. Please verify the storage volume is mounted and writable.",
      };
    }

    const oldSettings = await new BusinessSettingsRepository().findByOrganizationId(context.organizationId);

    if (oldSettings?.logoPath) {
      const oldPaths = [
        join(storageRoot, oldSettings.logoPath),
        join(process.cwd(), "public", oldSettings.logoPath),
      ];
      for (const op of oldPaths) {
        if (existsSync(op)) {
          await unlink(op).catch(() => {});
        }
      }
    }

    const filename = `logo.${ext}`;
    const filePath = join(dir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());

    try {
      await writeFile(filePath, buffer);
    } catch (err) {
      console.error("[upload-logo] Failed to write file", {
        storageRoot,
        destinationPath: filePath,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        uid: (process as any).getuid?.() ?? "N/A",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        gid: (process as any).getgid?.() ?? "N/A",
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        ok: false,
        message:
          "File could not be saved. Please verify the storage volume has write permissions for UID 1001.",
      };
    }

    const logoPath = `uploads/org-${context.organizationId}/${filename}`;
    await new BusinessSettingsRepository().updateForOrganization(context.organizationId, { logoPath });

    revalidatePath("/settings");

    return { ok: true, logoPath };
  } catch (error) {
    if (error instanceof BusinessError) {
      return { ok: false, message: error.message };
    }

    console.error("[upload-logo] Unexpected error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return {
      ok: false,
      message: "An unexpected error occurred while uploading the logo. Please check the server logs.",
    };
  }
}
