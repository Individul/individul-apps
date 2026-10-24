/**
 * Versiunea Worker-ului care răspunde acum.
 *
 * Next 15 schimbă identificatorii acțiunilor de server la fiecare build. O filă
 * deschisă dinaintea unei publicări cheamă deci acțiuni care nu mai există și
 * primește 404 la orice salvare. Clopoțelul citește versiunea la deschiderea
 * paginii; când o verificare a lui pică, o citește din nou. Dacă diferă, cere
 * reîncărcarea paginii, în loc ca salvările să eșueze fără explicație.
 *
 * E o rută GET obișnuită, nu o acțiune: așa supraviețuiește republicării.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

export async function GET() {
  const { env } = await getCloudflareContext({ async: true });
  // Sub `next dev` legătura poate lipsi; `null` nu se potrivește cu nimic și
  // nu declanșează anunțul.
  const versiune = env.CF_VERSION_METADATA?.id ?? null;
  return Response.json({ versiune }, { headers: { "Cache-Control": "no-store" } });
}
