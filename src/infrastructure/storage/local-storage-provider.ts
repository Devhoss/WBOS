import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import type { StorageProvider } from "./storage-provider";

export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly root = process.env.WBOS_STORAGE_ROOT ?? "./storage") {}

  async put(input: {
    organizationId: string;
    fileName: string;
    mimeType: string;
    buffer: Buffer;
  }) {
    const storageKey = path.join(input.organizationId, `${crypto.randomUUID()}-${input.fileName}`);
    const absolutePath = path.join(this.root, storageKey);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.buffer);

    return {
      storageKey,
      sizeBytes: input.buffer.byteLength,
      mimeType: input.mimeType,
      fileName: input.fileName,
    };
  }

  async get(storageKey: string) {
    return readFile(path.join(this.root, storageKey));
  }
}
