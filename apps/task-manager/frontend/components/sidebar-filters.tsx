"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskStatus, TaskPriority, User, fetchUsers, fetchCategories, fetchTags } from "@/lib/api";

interface SidebarFiltersProps {
  statusFilter: TaskStatus | "ALL";
  priorityFilter: TaskPriority | "ALL";
  assigneeFilter: number | "ALL";
  categoryFilter: string | "ALL";
  tagFilter: string | "ALL";
  onStatusChange: (status: TaskStatus | "ALL") => void;
  onPriorityChange: (priority: TaskPriority | "ALL") => void;
  onAssigneeChange: (assignee: number | "ALL") => void;
  onCategoryChange: (category: string | "ALL") => void;
  onTagChange: (tag: string | "ALL") => void;
}

export function SidebarFilters({
  statusFilter,
  priorityFilter,
  assigneeFilter,
  categoryFilter,
  tagFilter,
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
  onCategoryChange,
  onTagChange,
}: SidebarFiltersProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    fetchUsers().then(setUsers).catch(console.error);
    fetchCategories().then(setCategories).catch(console.error);
    fetchTags().then(setTags).catch(console.error);
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

      <Separator />

      <div>
        <h3 className="font-medium mb-3">Responsabil</h3>
        <Select
          value={assigneeFilter === "ALL" ? "ALL" : assigneeFilter.toString()}
          onValueChange={(value) => onAssigneeChange(value === "ALL" ? "ALL" : parseInt(value))}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selectează" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Toți</SelectItem>
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
            <SelectValue placeholder="Selectează" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Toate</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div>
        <h3 className="font-medium mb-3">Etichetă</h3>
        <Select
          value={tagFilter}
          onValueChange={(value) => onTagChange(value as string | "ALL")}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selectează" />
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
    </aside>
  );
}
