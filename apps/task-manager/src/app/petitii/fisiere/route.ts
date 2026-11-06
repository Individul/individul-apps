import { revalidatePath } from "next/cache";

import { citesteCererea } from "@/lib/attachment-upload";
import { getActor } from "@/lib/auth/server";
import * as data from "@/lib/data/attachments";
import { getDb } from "@/lib/db";
import { sigur } from "@/lib/sigur";
import { getFileStore } from "@/lib/storage";

/**
 * Primește un fișier de petiție, trimis ca atare (vezi `lib/attachment-upload.ts`
 * pentru motiv). Dreptul, tipul și mărimea le verifică tot `uploadAttachment`,
 * ca înainte; aici doar se citește cererea.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const cerere = citesteCererea(request);
  if (!cerere.ok) return Response.json({ error: cerere.error }, { status: cerere.status });

  const continut = await request.arrayBuffer();
  const res = await sigur(async () =>
    data.uploadAttachment(getDb(), getFileStore(), await getActor(), {
      petitionId: cerere.petitionId,
      kind: cerere.kind,
      file: {
        name: `fisier.${cerere.ext}`,
        type: (request.headers.get("content-type") ?? "").split(";")[0].trim(),
        size: continut.byteLength,
        arrayBuffer: async () => continut,
      },
    }),
  );
  if (res.success) revalidatePath("/petitii");
  return Response.json(res, { headers: { "Cache-Control": "no-store" } });
}
