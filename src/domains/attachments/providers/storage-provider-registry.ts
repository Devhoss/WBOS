import { LocalStorageProvider } from "./local-storage-provider";
import type { StorageProvider } from "./storage-provider";

export class StorageProviderRegistry {
  private providers = new Map<StorageProvider["name"], StorageProvider>();

  constructor(...initial: StorageProvider[]) {
    for (const provider of initial) {
      this.register(provider);
    }
  }

  register(provider: StorageProvider): void {
    this.providers.set(provider.name, provider);
  }

  get(name: StorageProvider["name"]): StorageProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`No storage provider registered for "${name}".`);
    }
    return provider;
  }

  has(name: StorageProvider["name"]): boolean {
    return this.providers.has(name);
  }
}

let defaultRegistry: StorageProviderRegistry | null = null;

export function getDefaultStorageProviderRegistry(): StorageProviderRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new StorageProviderRegistry(new LocalStorageProvider());
  }
  return defaultRegistry;
}