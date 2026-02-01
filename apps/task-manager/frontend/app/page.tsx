import { TaskList } from "@/components/task-list";
import { CheckSquare } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-16 border-b flex items-center px-6 shrink-0">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-6 w-6" />
          <h1 className="text-xl font-semibold">Manager de Sarcini</h1>
        </div>
      </header>
      <main className="flex-1">
        <TaskList />
      </main>
    </div>
  );
}
