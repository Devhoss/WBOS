export type StoredFile = {
  storageKey: string;
  sizeBytes: number;
  mimeType: string;
  fileName: string;
};

export interface StorageProvider {
  put(input: {
    organizationId: string;
    fileName: string;
    mimeType: string;
    buffer: Buffer;
  }): Promise<StoredFile>;

  get(storageKey: string): Promise<Buffer>;
}
