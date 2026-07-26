import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Backup complet al datelor aplicației (doar admin). Descarcă un .json cu
// sarcini, comentarii, etichete, legături task-etichetă și profiluri (pentru
// referință la restaurare). Nu include conturile auth (emailuri/parole).
export async function GET() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Neautentificat." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Doar adminul poate face backup." }, { status: 403 });
  }

  const [tasks, comments, tags, taskTags, profiles] = await Promise.all([
    supabase.from("tasks").select("*").order("created_at", { ascending: true }),
    supabase.from("comments").select("*").order("created_at", { ascending: true }),
    supabase.from("tags").select("*").order("name", { ascending: true }),
    supabase.from("task_tags").select("*"),
    supabase.from("profiles").select("*").order("full_name", { ascending: true }),
  ]);

  const firstError =
    tasks.error || comments.error || tags.error || taskTags.error || profiles.error;
  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  const backup = {
    app: "task-manager",
    version: 1,
    exported_at: new Date().toISOString(),
    counts: {
      tasks: tasks.data?.length ?? 0,
      comments: comments.data?.length ?? 0,
      tags: tags.data?.length ?? 0,
      task_tags: taskTags.data?.length ?? 0,
      profiles: profiles.data?.length ?? 0,
    },
    data: {
      tasks: tasks.data ?? [],
      comments: comments.data ?? [],
      tags: tags.data ?? [],
      task_tags: taskTags.data ?? [],
      profiles: profiles.data ?? [],
    },
  };

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(backup, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="task-manager-backup-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
