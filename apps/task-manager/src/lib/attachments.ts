export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB
export const ACCEPTED_MIME = ["application/pdf", "image/jpeg", "image/png"] as const;
export const ACCEPT_ATTR = ".pdf,.jpg,.jpeg,.png";

export type AttachmentKind = "petitie" | "raspuns";

export const KIND_LABEL: Record<AttachmentKind, string> = {
  petitie: "Petiția",
  raspuns: "Răspunsul",
};

/** Întoarce mesajul de eroare sau `null` dacă fișierul e acceptat. */
export function validateAttachment(file: { name: string; type: string; size: number }): string | null {
  if (file.size <= 0) return "Fișierul e gol.";
  if (!ACCEPTED_MIME.includes(file.type as (typeof ACCEPTED_MIME)[number])) {
    return "Sunt acceptate doar fișiere PDF, JPG sau PNG.";
  }
  if (file.size > MAX_ATTACHMENT_BYTES) return "Fișierul depășește 10 MB.";
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${trim(kb)} KB`;
  return `${trim(kb / 1024)} MB`;
}

function trim(n: number): string {
  // O zecimală, cu virgulă (convenție ro); fără „,0" inutil.
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : String(r).replace(".", ",");
}

/** Cale în bucket: {petitionId}/{uuid}-{nume-curățat}.{ext} */
export function storageKey(petitionId: string, fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  const ext = dot > -1 ? fileName.slice(dot + 1).toLowerCase() : "bin";
  const base = fileName.slice(0, dot > -1 ? dot : undefined);
  const slug =
    base
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "fisier";
  return `${petitionId}/${crypto.randomUUID()}-${slug}.${ext}`;
}
