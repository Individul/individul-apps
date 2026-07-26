"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/notifications/actions";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/types";

function relativeTime(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: ro });
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
  const [items, setItems] = useState<Notification[]>(initialItems);
  const [unread, setUnread] = useState<number>(initialUnread);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setItems((prev) => [payload.new as Notification, ...prev].slice(0, 20));
          setUnread((u) => u + 1);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

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
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-sm font-semibold">Notificări</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => void handleMarkAll()}
              className="text-xs font-normal text-muted-foreground transition-colors hover:text-foreground"
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
              return n.task_id ? (
                <Link
                  key={n.id}
                  href={`/tasks/${n.task_id}`}
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
