/**
 * Un bucket R2 în memorie, pentru teste: ține octeții și tipul fiecărei chei.
 * Doar pentru teste.
 */

import type { FileStore } from "./attachments";

export function memoryStore(opts: { failPut?: boolean } = {}) {
  const objects = new Map<string, { bytes: Uint8Array; contentType?: string }>();
  const store: FileStore & { keys(): string[] } = {
    async put(key, value, options) {
      if (opts.failPut) throw new Error("R2 indisponibil");
      const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
      objects.set(key, { bytes, contentType: options?.httpMetadata?.contentType });
    },
    async get(key) {
      const o = objects.get(key);
      if (!o) return null;
      return {
        body: new Blob([o.bytes.slice()]).stream(),
        size: o.bytes.length,
        httpMetadata: { contentType: o.contentType },
      };
    },
    async delete(keys) {
      for (const k of Array.isArray(keys) ? keys : [keys]) objects.delete(k);
    },
    keys: () => [...objects.keys()],
  };
  return store;
}
