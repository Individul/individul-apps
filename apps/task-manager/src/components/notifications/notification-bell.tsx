"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BellRing, BellOff } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ro } from "date-fns/locale";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as desktop from "@/lib/desktop-notifications";
import {
  markAllNotificationsRead,
  markNotificationRead,
  pollNotifications,
} from "@/app/notifications/actions";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/types";

function relativeTime(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: ro });
}

/** Versiunea Worker-ului care răspunde acum; `null` dacă nu se poate afla. */
async function versiuneaServerului(): Promise<string | null> {
  try {
    const res = await fetch("/versiune", { cache: "no-store" });
    if (!res.ok) return null;
    const { versiune } = (await res.json()) as { versiune?: unknown };
    return typeof versiune === "string" ? versiune : null;
  } catch {
    // Rețea căzută, sesiune expirată (vine pagina de logare, nu JSON): nu
    // știm nimic despre versiune, deci nu anunțăm nimic.
    return null;
  }
}

interface NotificationBellProps {
  initialItems: Notification[];
  initialUnread: number;
  userId: string;
}

export function NotificationBell({
  initialItems,
  initialUnread,
  userId,
}: NotificationBellProps) {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>(initialItems);
  const [unread, setUnread] = useState<number>(initialUnread);
  // Starea anunțurilor de sistem se citește abia după montare: pe server nu
  // există `Notification`, iar o valoare ghicită ar strica hidratarea.
  const [anunturi, setAnunturi] = useState<{
    supported: boolean;
    permission: NotificationPermission | null;
    enabled: boolean;
  }>({ supported: false, permission: null, enabled: false });

  useEffect(() => {
    setAnunturi({
      supported: desktop.isSupported(),
      permission: desktop.permission(),
      enabled: desktop.isEnabled(),
    });
  }, []);

  /**
   * Notificările noi, verificate la 30 de secunde și la revenirea în fereastră.
   *
   * Pe Supabase sosea fiecare pe loc, printr-un abonament în timp real; pe
   * Cloudflare nu există un asemenea canal, iar o întârziere de jumătate de
   * minut e neglijabilă pentru ce anunță clopoțelul. Reperul e cea mai nouă
   * notificare deja văzută — clipa scrisă de server, nu ceasul browserului,
   * care poate merge înainte sau în urmă.
   *
   * Anunțul de sistem apare doar pentru ce a sosit de la verificarea de
   * dinainte. La prima verificare fără reper (clopoțel gol la deschidere)
   * nimic nu e „nou": e doar ce exista deja.
   */
  const reper = useRef<string | null>(initialItems[0]?.created_at ?? null);
  const amorsat = useRef(initialItems.length > 0);

  /**
   * Versiunea aplicației din care s-a încărcat pagina.
   *
   * La fiecare publicare, Next schimbă identificatorii acțiunilor de server,
   * iar o filă deschisă dinainte primește 404 la orice salvare. Clopoțelul
   * verifică singur, deci el observă primul. Când o verificare pică, compară
   * versiunea de acum cu cea de la deschidere. Dacă diferă, cere o singură
   * dată reîncărcarea paginii și nu mai verifică degeaba.
   */
  const versiune = useRef<string | null>(null);
  const invechita = useRef(false);

  useEffect(() => {
    void versiuneaServerului().then((v) => {
      versiune.current = v;
    });
  }, []);

  useEffect(() => {
    let oprit = false;
    let inCurs = false;
    // Verificări ratate la rând. O filă rămasă fără sesiune (ieșire din altă
    // filă, sesiune expirată) primea refuz la fiecare jumătate de minut, cât
    // stătea deschisă. După trei ratări, ceasul nu mai verifică; o face doar
    // întoarcerea în fereastră, iar o reușită repornește ritmul obișnuit.
    let ratari = 0;

    const dupaEsec = async () => {
      const acum = await versiuneaServerului();
      if (oprit || invechita.current || !acum || !versiune.current || acum === versiune.current) return;
      invechita.current = true;
      toast("Aplicația a fost actualizată.", {
        description: "Reîncarcă pagina: până atunci, salvările din fila asta nu vor merge.",
        duration: Infinity,
        action: { label: "Reîncarcă", onClick: () => window.location.reload() },
      });
    };

    const verifica = async (dinCeas = false) => {
      if (inCurs || invechita.current || (dinCeas && ratari >= 3)) return;
      inCurs = true;
      try {
        const res = await pollNotifications(reper.current);
        if (oprit) return;
        if ("error" in res) {
          ratari++;
          return;
        }
        ratari = 0;
        if (res.fresh.length > 0) {
          reper.current = res.fresh[0].created_at;
          if (amorsat.current) {
            // Cele mai vechi întâi, ca anunțurile să apară în ordinea sosirii.
            for (const n of [...res.fresh].reverse()) desktop.show(n, (href) => router.push(href));
          }
          setItems((prev) => {
            const vazute = new Set(prev.map((n) => n.id));
            return [...res.fresh.filter((n) => !vazute.has(n.id)), ...prev].slice(0, 20);
          });
        }
        amorsat.current = true;
        setUnread(res.unread);
      } catch {
        // O verificare ratată (rețea, repornire) se reia peste 30 de secunde.
        // Dacă motivul e o publicare nouă, anunțul o spune.
        ratari++;
        void dupaEsec();
      } finally {
        inCurs = false;
      }
    };

    const interval = setInterval(() => void verifica(true), 30_000);
    const laRevenire = () => {
      if (document.visibilityState === "visible") void verifica();
    };
    document.addEventListener("visibilitychange", laRevenire);
    window.addEventListener("focus", laRevenire);
    return () => {
      oprit = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", laRevenire);
      window.removeEventListener("focus", laRevenire);
    };
  }, [userId, router]);

  const toggleAnunturi = async () => {
    if (anunturi.enabled) {
      desktop.setEnabled(false);
      setAnunturi((s) => ({ ...s, enabled: false }));
      return;
    }
    const p = await desktop.enable();
    setAnunturi((s) => ({ ...s, permission: p, enabled: p === "granted" }));
    if (p === "denied") {
      toast.error("Browserul a blocat anunțurile. Se reactivează din setările lui.");
    }
  };

  const handleItemClick = (n: Notification) => {
    if (n.read) return;
    setItems((prev) =>
      prev.map((it) => (it.id === n.id ? { ...it, read: true } : it)),
    );
    setUnread((u) => Math.max(0, u - 1));
    void markNotificationRead(n.id).then((res) => {
      if (res.error) toast.error(res.error);
    });
  };

  const handleMarkAll = async () => {
    const res = await markAllNotificationsRead();
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setItems((prev) => prev.map((it) => ({ ...it, read: true })));
    setUnread(0);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium leading-none text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
          <span className="sr-only">Notificări</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 w-80 overflow-y-auto">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold">Notificări</span>
            {/* Doar iconiță: alături de „Marchează toate citite” nu încap două
                etichete în 320px. Înțelesul stă în `title` și în `aria-label`,
                iar starea în culoare — aprins când sunt pornite. */}
            {anunturi.supported && (
              <button
                type="button"
                onClick={() => void toggleAnunturi()}
                aria-pressed={anunturi.enabled}
                title={
                  anunturi.permission === "denied"
                    ? "Anunțurile pe ecran sunt blocate din setările browserului"
                    : anunturi.enabled
                      ? "Anunțuri pe ecran: pornite. Click pentru a le opri."
                      : "Anunțuri pe ecran: oprite. Click pentru a le porni."
                }
                aria-label={
                  anunturi.enabled
                    ? "Oprește anunțurile pe ecran"
                    : "Pornește anunțurile pe ecran"
                }
                className={cn(
                  "rounded p-1 transition-colors hover:bg-accent",
                  anunturi.enabled
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {anunturi.enabled ? (
                  <BellRing className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <BellOff className="h-3.5 w-3.5" aria-hidden />
                )}
              </button>
            )}
          </div>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => void handleMarkAll()}
              className="shrink-0 text-xs font-normal text-muted-foreground transition-colors hover:text-foreground"
            >
              Marchează toate citite
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            Nicio notificare.
          </p>
        ) : (
          <div className="space-y-0.5 py-1">
            {items.map((n) => {
              const content = (
                <div className="flex gap-2">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      n.read ? "bg-transparent" : "bg-primary",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">{n.message}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {n.actor_name ? `${n.actor_name} · ` : ""}
                      {relativeTime(n.created_at)}
                    </p>
                  </div>
                </div>
              );
              const base = cn(
                "block rounded-md px-2 py-2 text-left",
                !n.read && "bg-accent/60",
              );
              // Aceeași țintă ca a anunțului de sistem: dacă regula se schimbă,
              // se schimbă în amândouă odată.
              const href = desktop.notificationHref(n);
              return href ? (
                <Link
                  key={n.id}
                  href={href}
                  onClick={() => handleItemClick(n)}
                  className={cn(base, "transition-colors hover:bg-accent")}
                >
                  {content}
                </Link>
              ) : (
                <div key={n.id} className={base}>
                  {content}
                </div>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
