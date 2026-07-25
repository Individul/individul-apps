import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getCurrentProfile, getProfiles } from "@/lib/queries";
import { UserRoleTable } from "@/components/admin/user-role-table";
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
          <ArrowLeft className="mr-2 h-4 w-4" /> Înapoi la task-uri
        </Button>
      </Link>
      <h1 className="mb-6 text-2xl font-semibold">Administrare utilizatori</h1>
      <UserRoleTable profiles={profiles} currentUserId={me.id} />
    </main>
  );
}
