import { NextResponse } from "next/server";

import { getActor } from "@/lib/auth/server";
import { canBackup } from "@/lib/acl";
import { getDb } from "@/lib/db";
import { buildDump } from "@/lib/backup-dump";

export const dynamic = "force-dynamic";

/**
 * Dumpul descărcat de admin — același format, până la ultimul spațiu, ca
 * fișierul scris de copia de noapte, fiindcă îl face aceeași funcție.
 */
export async function GET() {
  const me = await getActor();
  if (!me) return NextResponse.json({ error: "Neautentificat." }, { status: 401 });
  if (!canBackup(me)) {
    return NextResponse.json({ error: "Doar adminul poate face backup." }, { status: 403 });
  }

  const now = new Date();
  let json: string;
  try {
    json = await buildDump(getDb(), now);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }

  const date = now.toISOString().slice(0, 10);
  return new NextResponse(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="task-manager-backup-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
