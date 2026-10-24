import { getCurrentUserId } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import { attachmentForDownload } from "@/lib/data/attachments";
import { getFileStore } from "@/lib/storage";

/**
 * Servește un fișier de petiție din R2, cu sesiunea verificată.
 *
 * Verificarea stă aici, nu doar în middleware: căile se termină în `.png` sau
 * `.jpg`, iar exact acelea sunt sărite de middleware (ca imaginile statice).
 *
 * `?descarca=1` cere salvarea, sub numele generat („M-535-26-Ion-Popescu.pdf"),
 * ca vechiul link semnat cu `download`. Fără el, fișierul se deschide în filă.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request, props: { params: Promise<{ cheie: string[] }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return new Response("Neautentificat.", { status: 401 });

  const { cheie } = await props.params;
  const path = cheie.map(decodeURIComponent).join("/");
  const found = await attachmentForDownload(getDb(), getFileStore(), { id: userId }, path);
  if (!found) return new Response("Fișier inexistent.", { status: 404 });

  const { row, object } = found;
  const download = new URL(request.url).searchParams.get("descarca") === "1";
  // Numele cu diacritice merge în forma RFC 5987; `filename=` rămâne ASCII
  // pentru browserele vechi.
  const ascii = row.name.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/"/g, "");
  const disposition = `${download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(row.name)}`;

  return new Response(object.body, {
    headers: {
      "Content-Type": row.mime || object.httpMetadata?.contentType || "application/octet-stream",
      "Content-Length": String(object.size),
      "Content-Disposition": disposition,
      // Date personale: nimic nu le păstrează pe drum, nici browserul pe disc.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
