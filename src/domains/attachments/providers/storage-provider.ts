import type { StorageProvider as StorageProviderValue } from "@prisma/client";

export type StoredFileMeta = {
  storageKey: string;
  sizeBytes: number;
};

export type SaveFileInput = {
  organizationId: string;
  entityType: string;
  entityId: string;
  fileName: string;
  mimeType: string;
  data: Buffer;
};

export type StorageProviderName = StorageProviderValue;

export interface StorageProvider {
  readonly name: StorageProviderName;
  save(input: SaveFileInput): Promise<StoredFileMeta>;
  read(storageKey: string): Promise<Buffer | null>;
  delete(storageKey: string): Promise<void>;
  getUrl(storageKey: string): string | null;
}