import { Badge } from "@/components/ui/badge";
import { Task } from "@/lib/api";

type TaskStatus = Task["status"];
type TaskPriority = Task["priority"];

interface StatusBadgeProps {
  status: TaskStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  switch (status) {
    case "TODO":
      return <Badge variant="secondary">De facut</Badge>;
    case "IN_PROGRESS":
      return <Badge variant="outline">In progres</Badge>;
    case "DONE":
      return <Badge className="bg-green-100 text-green-700 border-transparent">Finalizat</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

interface PriorityBadgeProps {
  priority: TaskPriority;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  switch (priority) {
    case "HIGH":
      return <Badge className="bg-red-100 text-red-700 border-transparent">Ridicata</Badge>;
    case "MEDIUM":
      return <Badge className="bg-yellow-100 text-yellow-700 border-transparent">Medie</Badge>;
    case "LOW":
      return <Badge className="bg-green-100 text-green-700 border-transparent">Scazuta</Badge>;
    default:
      return <Badge variant="secondary">{priority}</Badge>;
  }
}
