import { Badge } from "@/components/ui/badge";
import { TaskStatus, TaskPriority } from "@/lib/api";

interface StatusBadgeProps {
  status: TaskStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  switch (status) {
    case "TODO":
      return <Badge variant="secondary">To Do</Badge>;
    case "IN_PROGRESS":
      return <Badge variant="outline">In Progress</Badge>;
    case "DONE":
      return <Badge className="bg-muted text-muted-foreground border-transparent">Done</Badge>;
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
      return <Badge className="bg-red-100 text-red-700 border-transparent">High</Badge>;
    case "MEDIUM":
      return <Badge className="bg-yellow-100 text-yellow-700 border-transparent">Medium</Badge>;
    case "LOW":
      return <Badge className="bg-green-100 text-green-700 border-transparent">Low</Badge>;
    default:
      return <Badge variant="secondary">{priority}</Badge>;
  }
}
