import { getContraveners, getCurrentProfile } from "@/lib/queries";
import { ContravenerList } from "@/components/contraveners/contravener-list";
import { todayInChisinau, toISODate } from "@/lib/periods";

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
          Hotărârile de arest contravențional. Cele mai recente stau primele. La un an de la
          data devenirii definitive, hotărârea neexecutată se prescrie și cere informare.
        </p>
      </div>

      {/* Ziua de azi, o singură dată și pe ora Chișinăului: din ea se socotește
          termenul fiecărui rând. Serverul merge pe UTC, iar între miezul
          nopții de aici și cel de la Greenwich lista ar fi numărat cu o zi în
          urmă — tocmai la hotarul dintre „azi e ultima zi" și „prescris". */}
      <ContravenerList
        contraveners={contraveners}
        isAdmin={profile?.role === "admin"}
        azi={toISODate(todayInChisinau())}
      />
    </main>
  );
}
