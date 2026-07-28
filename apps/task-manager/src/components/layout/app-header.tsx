import Link from "next/link";
import { ModuleTabs } from "@/components/layout/module-tabs";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ProfileDialog } from "@/components/account/profile-dialog";
import { ChangePasswordDialog } from "@/components/account/change-password-dialog";
import { Button } from "@/components/ui/button";
import type { Notification, Profile } from "@/lib/types";

interface AppHeaderProps {
  profile: Profile | null;
  notifications: Notification[];
  unread: number;
}

export function AppHeader({ profile, notifications, unread }: AppHeaderProps) {
  const isAdmin = profile?.role === "admin";
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-3 p-4 xl:px-10">
        <Link href="/" className="text-sm font-medium">
          Acasă
        </Link>
        <ModuleTabs />
        <div className="ml-auto flex items-center gap-2">
          {profile && (
            <NotificationBell
              initialItems={notifications}
              initialUnread={unread}
              userId={profile.id}
            />
          )}
          {isAdmin && (
            <Link href="/admin">
              <Button variant="outline" size="sm">
                Administrare
              </Button>
            </Link>
          )}
          <ProfileDialog
            currentFullName={profile?.full_name ?? ""}
            currentUsername={profile?.username ?? ""}
          />
          <ChangePasswordDialog />
          <form action="/auth/signout" method="post">
            <Button variant="outline" size="sm" type="submit">
              Deconectare
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
