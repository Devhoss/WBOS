import { describe, expect, it, afterEach } from "vitest";
import { validateConfig, getConfig } from "../lib/config";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("config", () => {
  it("reports missing required variables", () => {
    delete process.env.DATABASE_URL;
    delete process.env.BETTER_AUTH_SECRET;
    delete process.env.BETTER_AUTH_URL;

    const result = validateConfig();
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL"]);
  });

  it("passes when all required variables are set", () => {
    process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/wbos";
    process.env.BETTER_AUTH_SECRET = "secret";
    process.env.BETTER_AUTH_URL = "https://wbos.example.com";

    expect(validateConfig().ok).toBe(true);
  });

  it("applies defaults for optional variables", () => {
    process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/wbos";
    process.env.BETTER_AUTH_SECRET = "secret";
    process.env.BETTER_AUTH_URL = "https://wbos.example.com";
    delete process.env.WBOS_STORAGE_ROOT;
    delete process.env.WBOS_BACKUP_DIR;

    const config = getConfig();
    expect(config.storageRoot).toContain("public");
    expect(config.backupDir).toContain("backups");
  });

  it("honours explicitly set optional variables", () => {
    process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/wbos";
    process.env.BETTER_AUTH_SECRET = "secret";
    process.env.BETTER_AUTH_URL = "https://wbos.example.com";
    process.env.WBOS_STORAGE_ROOT = "/srv/wbos/storage";
    process.env.WBOS_BACKUP_DIR = "/srv/wbos/backups";

    const config = getConfig();
    expect(config.storageRoot).toBe("/srv/wbos/storage");
    expect(config.backupDir).toBe("/srv/wbos/backups");
  });

  it("throws when getConfig is called with missing variables", () => {
    delete process.env.DATABASE_URL;

    expect(() => getConfig()).toThrow(/DATABASE_URL/);
  });
});
