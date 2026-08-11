import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  assertStorageCapacity,
  DEFAULT_STORAGE_MIN_FREE_BYTES,
  humanBytes,
  resolveStorageMinFreeBytes,
} from "@/infrastructure/storage/assert-capacity";

describe("resolveStorageMinFreeBytes", () => {
  const original = process.env.WBOS_STORAGE_MIN_FREE_BYTES;

  beforeEach(() => {
    delete process.env.WBOS_STORAGE_MIN_FREE_BYTES;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.WBOS_STORAGE_MIN_FREE_BYTES;
    else process.env.WBOS_STORAGE_MIN_FREE_BYTES = original;
  });

  it("defaults to 512 MB when unset", () => {
    expect(resolveStorageMinFreeBytes()).toBe(DEFAULT_STORAGE_MIN_FREE_BYTES);
    expect(DEFAULT_STORAGE_MIN_FREE_BYTES).toBe(512 * 1024 * 1024);
  });

  it("reads a valid override", () => {
    process.env.WBOS_STORAGE_MIN_FREE_BYTES = "1048576";
    expect(resolveStorageMinFreeBytes()).toBe(1048576);
  });

  it("falls back to the default for invalid values", () => {
    process.env.WBOS_STORAGE_MIN_FREE_BYTES = "not-a-number";
    expect(resolveStorageMinFreeBytes()).toBe(DEFAULT_STORAGE_MIN_FREE_BYTES);
    process.env.WBOS_STORAGE_MIN_FREE_BYTES = "-5";
    expect(resolveStorageMinFreeBytes()).toBe(DEFAULT_STORAGE_MIN_FREE_BYTES);
  });
});

describe("humanBytes", () => {
  it("formats bytes human-readably", () => {
    expect(humanBytes(512)).toBe("512 B");
    expect(humanBytes(2048)).toBe("2 KB");
    expect(humanBytes(10 * 1024 * 1024)).toBe("10 MB");
    expect(humanBytes(2 * 1024 * 1024 * 1024)).toBe("2 GB");
  });
});

describe("assertStorageCapacity", () => {
  const floor = 512 * 1024 * 1024;

  it("passes when there is plenty of free space", () => {
    expect(() =>
      assertStorageCapacity("/data/storage", 1024, floor, () => 10 * 1024 * 1024 * 1024),
    ).not.toThrow();
  });

  it("rejects when a write would leave less than the reserved floor free", () => {
    expect(() =>
      assertStorageCapacity("/data/storage", 1024, floor, () => floor + 512),
    ).toThrowError(/nearly full/);
  });

  it("rejects when the file itself exceeds available free space", () => {
    let code: string | null = null;
    try {
      assertStorageCapacity("/data/storage", 5 * 1024 * 1024 * 1024, floor, () => 1024);
    } catch (error) {
      code = (error as { code?: string }).code ?? null;
    }
    expect(code).toBe("STORAGE_FULL");
  });

  it("passes when free space cannot be measured", () => {
    expect(() => assertStorageCapacity("/data/storage", 1024, floor, () => null)).not.toThrow();
  });

  it("ignores non-positive sizes", () => {
    expect(() => assertStorageCapacity("/data/storage", 0, floor, () => 0)).not.toThrow();
  });
});
