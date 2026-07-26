import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";

import { getCurrentProfile, getProfiles } from "@/lib/queries";
import { UserRoleTable } from "@/components/admin/user-role-table";
import { RestoreBackup } from "@/components/admin/restore-backup";
import { CreateUserDialog } from "@/components/admin/create-user-dialog";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const me = await getCurrentProfile();
  if (me?.role !== "admin") redirect("/tasks");
  const profiles = await getProfiles();
  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href="/tasks">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Înapoi la sarcini
        </Button>
      </Link>
      <h1 className="mb-6 text-2xl font-semibold">Administrare</h1>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Utilizatori</h2>
          <CreateUserDialog />
        </div>
        <UserRoleTable profiles={profiles} currentUserId={me.id} />
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-lg font-semibold">Backup &amp; restaurare</h2>
        <p className="text-sm text-muted-foreground">
          Descarcă un snapshot complet (sarcini, comentarii, etichete, responsabili) ca
          fișier JSON. Restaurarea adaugă doar înregistrările lipsă — nu șterge și nu
          suprascrie nimic.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <a href="/admin/backup">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" /> Descarcă backup (JSON)
            </Button>
          </a>
          <RestoreBackup />
        </div>
      </section>
    </main>
  );
}
