"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Task, TaskUser, TaskFilters, tasksApi } from "@/lib/api";

type TaskStatus = Task["status"];
type TaskPriority = Task["priority"];

interface SidebarFiltersProps {
  statusFilter: TaskStatus | "ALL";
  priorityFilter: TaskPriority | "ALL";
  assigneeFilter: number | "ALL";
  categoryFilter: string | "ALL";
  tagFilter: string | "ALL";
  deadlineFrom: string;
  deadlineTo: string;
  onStatusChange: (status: TaskStatus | "ALL") => void;
  onPriorityChange: (priority: TaskPriority | "ALL") => void;
  onAssigneeChange: (assignee: number | "ALL") => void;
  onCategoryChange: (category: string | "ALL") => void;
  onTagChange: (tag: string | "ALL") => void;
  onDeadlineFromChange: (date: string) => void;
  onDeadlineToChange: (date: string) => void;
}

export function SidebarFilters({
  statusFilter,
  priorityFilter,
  assigneeFilter,
  categoryFilter,
  tagFilter,
  deadlineFrom,
  deadlineTo,
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
  onCategoryChange,
  onTagChange,
  onDeadlineFromChange,
  onDeadlineToChange,
}: SidebarFiltersProps) {
  const [users, setUsers] = useState<TaskUser[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  const categories = [
    { value: "CUMULARE", label: "Cumulare" },
    { value: "AREST_PREVENTIV", label: "Arest preventiv" },
    { value: "NECLARITATI", label: "Neclaritati" },
  ];

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    tasksApi.users(token).then(setUsers).catch(console.error);
    tasksApi.tags(token).then(setTags).catch(console.error);
  }, []);

  return (
    <aside className="w-56 shrink-0 border-r p-4 space-y-6 overflow-y-auto">
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
              De facut
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="IN_PROGRESS" id="status-progress" />
            <Label htmlFor="status-progress" className="font-normal cursor-pointer">
              In progres
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
              Ridicata
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
              Scazuta
            </Label>
          </div>
        </RadioGroup>
      </div>

      <Separator />

      <div>
        <h3 className="font-medium mb-3">Responsabil</h3>
        <Select
          value={assigneeFilter === "ALL" ? "ALL" : assigneeFilter.toString()}
          onValueChange={(value) => onAssigneeChange(value === "ALL" ? "ALL" : parseInt(value))}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecteaza" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Toti</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id.toString()}>
                {user.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div>
        <h3 className="font-medium mb-3">Categorie</h3>
        <Select
          value={categoryFilter}
          onValueChange={(value) => onCategoryChange(value as string | "ALL")}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecteaza" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Toate</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div>
        <h3 className="font-medium mb-3">Eticheta</h3>
        <Select
          value={tagFilter}
          onValueChange={(value) => onTagChange(value as string | "ALL")}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecteaza" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Toate</SelectItem>
            {tags.map((tag) => (
              <SelectItem key={tag} value={tag}>
                {tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div>
        <h3 className="font-medium mb-3">Termen limita</h3>
        <div className="space-y-2">
          <div>
            <Label htmlFor="deadline-from" className="text-xs text-muted-foreground">
              De la
            </Label>
            <Input
              id="deadline-from"
              type="date"
              value={deadlineFrom}
              onChange={(e) => onDeadlineFromChange(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <Label htmlFor="deadline-to" className="text-xs text-muted-foreground">
              Pana la
            </Label>
            <Input
              id="deadline-to"
              type="date"
              value={deadlineTo}
              onChange={(e) => onDeadlineToChange(e.target.value)}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
