import { mkdir, unlink, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { existsSync } from "fs";

import { uid } from "@/lib/uid";

import type { SaveFileInput, StorageProvider, StorageProviderName, StoredFileMeta } from "./storage-provider";

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "").replace(/\.\./g, "").slice(0, 64);
}

export class LocalStorageProvider implements StorageProvider {
  readonly name: StorageProviderName = "LOCAL";

  constructor(
    private readonly storageRoot: string = process.env.WBOS_STORAGE_ROOT ?? join(process.cwd(), "public"),
  ) {}

  private resolveAbsolutePath(storageKey: string): string {
    const safeKey = storageKey.replace(/\.\./g, "").replace(/^\/+/, "");
    return join(this.storageRoot, safeKey);
  }

  async save(input: SaveFileInput): Promise<StoredFileMeta> {
    const ext = input.fileName.split(".").pop()?.toLowerCase() ?? "";
    const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : "bin";
    const uniqueName = `${uid()}.${safeExt}`;
    const relativeDir = [
      "uploads",
      "attachments",
      sanitizeSegment(input.organizationId),
      sanitizeSegment(input.entityType),
      sanitizeSegment(input.entityId),
    ].join("/");
    const storageKey = `${relativeDir}/${uniqueName}`;
    const absolutePath = this.resolveAbsolutePath(storageKey);

    const dir = dirname(absolutePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(absolutePath, input.data);
    return { storageKey, sizeBytes: input.data.byteLength };
  }

  async read(storageKey: string): Promise<Buffer | null> {
    const absolutePath = this.resolveAbsolutePath(storageKey);
    if (!existsSync(absolutePath)) {
      return null;
    }
    const { readFile } = await import("fs/promises");
    return readFile(absolutePath);
  }

  async delete(storageKey: string): Promise<void> {
    const absolutePath = this.resolveAbsolutePath(storageKey);
    if (existsSync(absolutePath)) {
      await unlink(absolutePath).catch(() => {});
    }
  }

  getUrl(storageKey: string): string | null {
    return `/api/uploads/${storageKey}`;
  }
}
