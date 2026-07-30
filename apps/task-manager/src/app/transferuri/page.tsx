import {
  getCurrentProfile,
  getNotifications,
  getTransfers,
  getUnreadCount,
} from "@/lib/queries";
import { AppHeader } from "@/components/layout/app-header";
import { TransfersWorkspace } from "@/components/transfers/transfers-workspace";
import { toISODate } from "@/lib/periods";

export const dynamic = "force-dynamic";

export default async function TransferuriPage() {
  const [profile, notifications, unread, transfers] = await Promise.all([
    getCurrentProfile(),
    getNotifications(),
    getUnreadCount(),
    // Registrul întreg, o singură dată. Perioada se alege în pagină și taie din
    // ce e deja în memorie: schimbarea ei nu costă încă o interogare.
    getTransfers(),
  ]);

  return (
    <>
      <AppHeader profile={profile} notifications={notifications} unread={unread} />
      <main className="mx-auto max-w-5xl space-y-8 p-4 xl:px-10">
        <div>
          <h1 className="text-2xl font-semibold">Transferuri</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Transferurile condamnaților între penitenciare: cifre pe zi și penitenciar, nu persoane.
          </p>
        </div>

        <TransfersWorkspace
          transfers={transfers}
          // Ziua curentă vine de la server, ca perioada și zilele programate să
          // nu depindă de ceasul browserului.
          today={toISODate(new Date())}
          isAdmin={profile?.role === "admin"}
        />
      </main>
    </>
  );
}
