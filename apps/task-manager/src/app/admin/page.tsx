import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";

import {
  getCurrentProfile,
  getProfiles,
  getAuditLog,
  getNotifications,
  getUnreadCount,
} from "@/lib/queries";
import { AppHeader } from "@/components/layout/app-header";
import { UserRoleTable } from "@/components/admin/user-role-table";
import { RestoreBackup } from "@/components/admin/restore-backup";
import { CreateUserDialog } from "@/components/admin/create-user-dialog";
import { AuditTable } from "@/components/admin/audit-table";
import { AuditTabs } from "@/components/admin/audit-tabs";
import { entitiesFor, readAuditModule } from "@/lib/audit-modules";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { modul?: string };
}) {
  const me = await getCurrentProfile();
  if (me?.role !== "admin") redirect("/");
  const auditModule = readAuditModule(searchParams.modul);
  const [profiles, audit, notifications, unread] = await Promise.all([
    getProfiles(),
    getAuditLog(100, entitiesFor(auditModule)),
    getNotifications(),
    getUnreadCount(),
  ]);
  return (
    <>
      <AppHeader profile={me} notifications={notifications} unread={unread} />
      <main className="mx-auto max-w-[1800px] p-4 xl:px-10">
      <Link href="/sarcini">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Înapoi la sarcini
        </Button>
      </Link>
      <h1 className="mb-6 text-2xl font-semibold">Administrare</h1>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-10">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Utilizatori</h2>
              <CreateUserDialog />
            </div>
            <UserRoleTable profiles={profiles} currentUserId={me.id} />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Backup &amp; restaurare</h2>
            <p className="text-sm text-muted-foreground">
              Descarcă baza de date întreagă (sarcini, petiții, ședințe, transferuri,
              statistici, audit) ca fișier JSON. Fără conturi și fără fișierele atașate —
              pe acelea le duce copia automată de noapte, împreună cu notificările
              tuturor. Restaurarea automată acoperă doar formatul vechi; pentru un fișier
              de azi, vezi procedura din README.
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
        </div>

        <aside className="lg:w-[420px] lg:shrink-0">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Audit</h2>
            <p className="text-sm text-muted-foreground">
              Ultimele modificări (cine, ce, când). Se înregistrează automat.
            </p>
            <AuditTabs active={auditModule} />
            <AuditTable entries={audit} />
          </section>
        </aside>
      </div>
      </main>
    </>
  );
}
