import { getCloudflareContext } from "@opennextjs/cloudflare";

import type { FileStore } from "@/lib/data/attachments";

/**
 * Bucketul R2 al fișierelor (legătura `FISIERE` din wrangler.toml).
 *
 * Doar pe server: în browser nu ajunge nicio cheie. Încărcarea și descărcarea
 * trec prin aplicație, care verifică sesiunea și dreptul înainte.
 */
export function getFileStore(): FileStore {
  return getCloudflareContext().env.FISIERE as unknown as FileStore;
}
