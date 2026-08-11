import { statfsSync } from "fs";

import { BusinessError } from "@/shared/errors/business-error";

export const DEFAULT_STORAGE_MIN_FREE_BYTES = 512 * 1024 * 1024;

export function resolveStorageMinFreeBytes(raw = process.env.WBOS_STORAGE_MIN_FREE_BYTES): number {
  if (!raw) return DEFAULT_STORAGE_MIN_FREE_BYTES;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_STORAGE_MIN_FREE_BYTES;
}

export function freeBytesAt(path: string): number | null {
  try {
    const s = statfsSync(path);
    return s.bavail * s.bsize;
  } catch {
    return null;
  }
}

export function humanBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return `${bytes}`;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const fixed = value.toFixed(unit === 0 ? 0 : 1);
  const pretty = fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
  return `${pretty} ${units[unit]}`;
}

/**
 * Blocks a write when writing `bytesNeeded` to `targetPath` would leave less
 * than the reserved floor free on the storage filesystem. This is the hard stop
 * that prevents attachment/logo growth from silently filling the host disk
 * (and producing ENOSPC errors mid-write).
 *
 * When free space cannot be measured (e.g. the path does not exist yet) the
 * guard passes and lets the write attempt fail naturally.
 */
export function assertStorageCapacity(
  targetPath: string,
  bytesNeeded: number,
  minFreeBytes = resolveStorageMinFreeBytes(),
  getFreeBytes: (path: string) => number | null = freeBytesAt,
): void {
  if (bytesNeeded <= 0) return;
  const free = getFreeBytes(targetPath);
  if (free === null) return;
  if (bytesNeeded > free || free - bytesNeeded < minFreeBytes) {
    throw new BusinessError(
      `Storage is nearly full (${humanBytes(free)} free, ${humanBytes(minFreeBytes)} reserved for the system). Upload blocked until space is freed.`,
      "STORAGE_FULL",
    );
  }
}
