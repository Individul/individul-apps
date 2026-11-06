/**
 * Urcarea unui fișier de petiție: cererea din browser și citirea ei pe server.
 *
 * De ce nu o acțiune de server (06.11.2026): filtrul gratuit al Cloudflare are
 * regula „React - Leaking Server Functions - CVE:CVE-2025-55183”, care citește
 * corpul cererilor de acțiune. Octeții unei poze JPG pot semăna întâmplător cu
 * atacul, iar cererea se oprește la intrare, înainte de Worker. Așa s-a
 * întâmplat la N-978/26: aceeași poză, blocată de opt ori la rând.
 *
 * Aici fișierul pleacă singur, ca atare, spre o rută obișnuită: fără antetul
 * `Next-Action` și fără plicul acțiunii, deci regula n-are ce citi. Petiția și
 * tipul stau în adresă. Numele original al fișierului nu pleacă: din el
 * trebuie doar extensia, iar numele afișat îl compune serverul din petiție.
 */

import type { AttachmentKind } from "@/lib/attachments";
import { MAX_ATTACHMENT_BYTES } from "@/lib/attachments";

export const RUTA_URCARE = "/petitii/fisiere";

export type RezultatUrcare = { error?: string; success?: boolean };

export const MESAJ_RETEA =
  "Fișierul n-a putut fi urcat. Verifică legătura și încearcă din nou; dacă nu merge, reîncarcă pagina.";
export const MESAJ_FILTRU =
  "Fișierul a fost oprit de filtrul de securitate al Cloudflare, nu de aplicație. Spune-i administratorului ce fișier era.";
export const MESAJ_SESIUNE = "Sesiunea a expirat. Reîncarcă pagina și conectează-te din nou.";

function extensie(nume: string): string {
  const punct = nume.lastIndexOf(".");
  const ext = punct > -1 ? nume.slice(punct + 1).toLowerCase() : "";
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : "bin";
}

/** Trimite fișierul și întoarce răspunsul serverului, sau un mesaj pe înțeles. */
export async function urcaFisier(
  petitionId: string,
  kind: AttachmentKind,
  file: File,
  trimite: typeof fetch = fetch,
): Promise<RezultatUrcare> {
  const q = new URLSearchParams({ petitie: petitionId, tip: kind, ext: extensie(file.name) });
  let r: Response;
  try {
    r = await trimite(`${RUTA_URCARE}?${q}`, {
      method: "POST",
      body: file,
      headers: { "Content-Type": file.type || "application/octet-stream" },
      credentials: "same-origin",
    });
  } catch {
    return { error: MESAJ_RETEA };
  }
  if ((r.headers.get("content-type") ?? "").includes("application/json")) {
    try {
      return (await r.json()) as RezultatUrcare;
    } catch {
      return { error: MESAJ_RETEA };
    }
  }
  // Fără sesiune, poarta trimite la /login: fetch urmează și primește pagina.
  if (r.redirected && new URL(r.url).pathname.startsWith("/login")) return { error: MESAJ_SESIUNE };
  // Un 403 care nu e al nostru (al nostru e JSON) vine de la filtrul Cloudflare.
  if (r.status === 403) return { error: MESAJ_FILTRU };
  return { error: `Fișierul n-a putut fi urcat (cod ${r.status}). Reîncarcă pagina și încearcă din nou.` };
}

export type CerereUrcare =
  | { ok: true; petitionId: string; kind: AttachmentKind; ext: string }
  | { ok: false; status: number; error: string };

/**
 * Ce cere browserul, verificat înainte de citirea corpului.
 *
 * Originea trebuie să fie chiar aplicația. Cookie-ul de sesiune e `SameSite=Lax`
 * și oricum nu pleacă într-un POST de pe alt site, dar o rută obișnuită nu are
 * verificarea pe care Next o face singur acțiunilor, deci o facem aici.
 */
export function citesteCererea(request: Request): CerereUrcare {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (!origin || origin !== url.origin) return { ok: false, status: 403, error: "Cerere din afara aplicației." };

  const petitionId = url.searchParams.get("petitie") ?? "";
  const kind = url.searchParams.get("tip") ?? "";
  const ext = url.searchParams.get("ext") ?? "";
  if (!petitionId) return { ok: false, status: 400, error: "Lipsește petiția." };
  if (kind !== "petitie" && kind !== "raspuns") return { ok: false, status: 400, error: "Tip de fișier necunoscut." };
  if (!/^[a-z0-9]{1,8}$/.test(ext)) return { ok: false, status: 400, error: "Extensie necunoscută." };

  // Mărimea declarată, înainte să citim zece megaocteți degeaba.
  const lungime = Number(request.headers.get("content-length") ?? "0");
  if (lungime > MAX_ATTACHMENT_BYTES) return { ok: false, status: 413, error: "Fișierul depășește 10 MB." };

  return { ok: true, petitionId, kind, ext };
}
