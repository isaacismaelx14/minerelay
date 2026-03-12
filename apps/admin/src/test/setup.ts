import "@testing-library/jest-dom/vitest";

type StorageMap = Map<string, string>;

function createStorageShim(backingStore: StorageMap): Storage {
  return {
    get length(): number {
      return backingStore.size;
    },
    clear(): void {
      backingStore.clear();
    },
    getItem(key: string): string | null {
      return backingStore.has(key) ? backingStore.get(key)! : null;
    },
    key(index: number): string | null {
      if (!Number.isInteger(index) || index < 0) {
        return null;
      }
      return Array.from(backingStore.keys())[index] ?? null;
    },
    removeItem(key: string): void {
      backingStore.delete(key);
    },
    setItem(key: string, value: string): void {
      backingStore.set(String(key), String(value));
    },
  };
}

const localStorageBacking = new Map<string, string>();
const localStorageShim = createStorageShim(localStorageBacking);

Object.defineProperty(window, "localStorage", {
  configurable: true,
  enumerable: true,
  writable: true,
  value: localStorageShim,
});
