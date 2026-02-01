"use client";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { TaskStatus, TaskPriority } from "@/lib/api";

interface SidebarFiltersProps {
  statusFilter: TaskStatus | "ALL";
  priorityFilter: TaskPriority | "ALL";
  onStatusChange: (status: TaskStatus | "ALL") => void;
  onPriorityChange: (priority: TaskPriority | "ALL") => void;
}

export function SidebarFilters({
  statusFilter,
  priorityFilter,
  onStatusChange,
  onPriorityChange,
}: SidebarFiltersProps) {
  return (
    <aside className="w-56 shrink-0 border-r p-4 space-y-6">
      <div>
        <h3 className="font-medium mb-3">Status</h3>
        <RadioGroup
          value={statusFilter}
          onValueChange={(value) => onStatusChange(value as TaskStatus | "ALL")}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="ALL" id="status-all" />
            <Label htmlFor="status-all" className="font-normal cursor-pointer">
              Toate
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="TODO" id="status-todo" />
            <Label htmlFor="status-todo" className="font-normal cursor-pointer">
              De făcut
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="IN_PROGRESS" id="status-progress" />
            <Label htmlFor="status-progress" className="font-normal cursor-pointer">
              În progres
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="DONE" id="status-done" />
            <Label htmlFor="status-done" className="font-normal cursor-pointer">
              Finalizat
            </Label>
          </div>
        </RadioGroup>
      </div>

      <Separator />

      <div>
        <h3 className="font-medium mb-3">Prioritate</h3>
        <RadioGroup
          value={priorityFilter}
          onValueChange={(value) => onPriorityChange(value as TaskPriority | "ALL")}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="ALL" id="priority-all" />
            <Label htmlFor="priority-all" className="font-normal cursor-pointer">
              Toate
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="HIGH" id="priority-high" />
            <Label htmlFor="priority-high" className="font-normal cursor-pointer">
              Ridicată
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="MEDIUM" id="priority-medium" />
            <Label htmlFor="priority-medium" className="font-normal cursor-pointer">
              Medie
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="LOW" id="priority-low" />
            <Label htmlFor="priority-low" className="font-normal cursor-pointer">
              Scăzută
            </Label>
          </div>
        </RadioGroup>
      </div>
    </aside>
  );
}
