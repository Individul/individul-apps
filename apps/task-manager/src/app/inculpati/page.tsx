import { getCurrentProfile, getDefendants } from "@/lib/queries";
import { DefendantList } from "@/components/defendants/defendant-list";
import { Pagina } from "@/components/layout/pagina";

export const dynamic = "force-dynamic";

export default async function InculpatiPage() {
  const [defendants, profile] = await Promise.all([
    getDefendants(),
    getCurrentProfile(),
  ]);

  return (
    <Pagina latime="ingusta" className="space-y-6 print:max-w-none print:space-y-0" cadru="print:max-w-none print:p-0">
      {/* Titlul paginii nu se tipărește: foaia are antetul ei (DefendantPrint). */}
      <div className="print:hidden">
        <h1 className="text-2xl font-semibold">Preveniți și inculpați</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cu tip de penitenciar stabilit. Cine are măsură preventivă e prevenit, ceilalți
          inculpați. Cine devine condamnat iese din listă, dar rămâne în evidență.
        </p>
      </div>

      <DefendantList defendants={defendants} isAdmin={profile?.role === "admin"} />
    </Pagina>
  );
}
