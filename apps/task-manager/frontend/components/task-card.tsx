"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { Task } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Calendar, Tag, User } from "lucide-react";

interface TaskCardProps {
  task: Task;
}

function getCategoryLabel(category: string): string {
  switch (category) {
    case "CUMULARE": return "Cumulare";
    case "AREST_PREVENTIV": return "Arest preventiv";
    case "NECLARITATI": return "Neclarități";
    default: return category;
  }
}

export function TaskCard({ task }: TaskCardProps) {
  return (
    <Link href={`/task/${task.id}`}>
      <Card className="cursor-pointer hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium line-clamp-1">
            {task.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {task.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {task.description}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {task.category && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {getCategoryLabel(task.category)}
              </span>
            )}
          </div>
          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <Tag className="h-3 w-3 text-muted-foreground" />
              {task.tags.map((tag, index) => (
                <span
                  key={index}
                  className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {task.assignee_details && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span>{task.assignee_details.full_name}</span>
            </div>
          )}
          {task.deadline && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>Termen: {formatDate(task.deadline)}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
