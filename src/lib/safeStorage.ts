/**
 * Storage helpers that never throw.
 *
 * Safari in private browsing, "block all cookies", and some security
 * extensions make `window.localStorage` access throw a SecurityError.
 * Reading it during module evaluation therefore kills the whole app before
 * React can render anything — the classic blank white screen.
 *
 * These helpers degrade to an in-memory store instead of throwing, so the
 * session simply isn't remembered after a reload.
 */

const memoryStore = new Map<string, string>();

let nativeStorage: Storage | null | undefined;

function getNativeStorage(): Storage | null {
  if (nativeStorage !== undefined) return nativeStorage;
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      nativeStorage = null;
      return nativeStorage;
    }
    // Probe: access alone can throw, and so can writing when the store is full.
    const probeKey = "__ccc_storage_probe__";
    window.localStorage.setItem(probeKey, "1");
    window.localStorage.removeItem(probeKey);
    nativeStorage = window.localStorage;
  } catch {
    nativeStorage = null;
  }
  return nativeStorage;
}

export function isPersistentStorageAvailable(): boolean {
  return getNativeStorage() !== null;
}

export function safeGetItem(key: string): string | null {
  const store = getNativeStorage();
  if (store) {
    try {
      return store.getItem(key);
    } catch {
      /* fall through to memory */
    }
  }
  return memoryStore.has(key) ? (memoryStore.get(key) as string) : null;
}

export function safeSetItem(key: string, value: string): void {
  memoryStore.set(key, value);
  const store = getNativeStorage();
  if (!store) return;
  try {
    store.setItem(key, value);
  } catch {
    /* quota or blocked — memory copy is enough for this session */
  }
}

export function safeRemoveItem(key: string): void {
  memoryStore.delete(key);
  const store = getNativeStorage();
  if (!store) return;
  try {
    store.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Object shaped for the Supabase auth `storage` option. */
export const safeStorage = {
  getItem: (key: string) => safeGetItem(key),
  setItem: (key: string, value: string) => safeSetItem(key, value),
  removeItem: (key: string) => safeRemoveItem(key),
};
