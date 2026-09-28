import { getContraveners, getCurrentProfile } from "@/lib/queries";
import { ContravenerList } from "@/components/contraveners/contravener-list";

export const dynamic = "force-dynamic";

export default async function ContravenientiPage() {
  const [contraveners, profile] = await Promise.all([
    getContraveners(),
    getCurrentProfile(),
  ]);

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 xl:px-10">
      <div>
        <h1 className="text-2xl font-semibold">Contravenienți</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cei aduși să execute arest contravențional. Cele mai recente hotărâri stau primele.
        </p>
      </div>

      <ContravenerList contraveners={contraveners} isAdmin={profile?.role === "admin"} />
    </main>
  );
}
