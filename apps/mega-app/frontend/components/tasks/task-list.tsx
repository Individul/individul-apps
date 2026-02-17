"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskCard } from "@/components/tasks/task-card";
import { TaskForm } from "@/components/tasks/task-form";
import { SidebarFilters } from "@/components/tasks/sidebar-filters";
import { Task, TaskFilters, tasksApi } from "@/lib/api";
import { Plus, Loader2 } from "lucide-react";

type TaskStatus = Task["status"];
type TaskPriority = Task["priority"];

// Map URL status param to tab value
function statusToTab(status?: string): string {
  switch (status?.toUpperCase()) {
    case 'TODO': return 'todo';
    case 'IN_PROGRESS': return 'in-progress';
    case 'DONE': return 'done';
    default: return 'todo';
  }
}

interface TaskListProps {
  initialStatus?: string;
}

export function TaskList({ initialStatus }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "ALL">("ALL");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "ALL">("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState<number | "ALL">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string | "ALL">("ALL");
  const [tagFilter, setTagFilter] = useState<string | "ALL">("ALL");
  const [deadlineFrom, setDeadlineFrom] = useState<string>("");
  const [deadlineTo, setDeadlineTo] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>(statusToTab(initialStatus));
  const [formOpen, setFormOpen] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      if (!token) return;

      const params = new URLSearchParams();

      // Use sidebar filter or tab filter for status
      if (statusFilter !== "ALL") {
        params.append("status", statusFilter);
      } else if (activeTab !== "all") {
        params.append("status", activeTab.toUpperCase().replace("-", "_"));
      }

      if (priorityFilter !== "ALL") {
        params.append("priority", priorityFilter);
      }

      if (assigneeFilter !== "ALL") {
        params.append("assignee", assigneeFilter.toString());
      }

      if (categoryFilter !== "ALL") {
        params.append("category", categoryFilter);
      }

      if (tagFilter !== "ALL") {
        params.append("tags", tagFilter);
      }

      if (deadlineFrom) {
        params.append("deadline_from", deadlineFrom);
      }

      if (deadlineTo) {
        params.append("deadline_to", deadlineTo);
      }

      const data = await tasksApi.list(token, params);
      setTasks(data);
    } catch (error) {
      console.error("Failed to load tasks:", error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, assigneeFilter, categoryFilter, tagFilter, deadlineFrom, deadlineTo, activeTab]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  function handleNewTask() {
    setFormOpen(true);
  }

  function handleFormSuccess() {
    loadTasks();
  }

  function handleStatusFilterChange(status: TaskStatus | "ALL") {
    setStatusFilter(status);
    if (status !== "ALL") {
      setActiveTab("all"); // Reset tab when using sidebar filter
    }
  }

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    if (tab !== "all") {
      setStatusFilter("ALL"); // Reset sidebar filter when using tabs
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <SidebarFilters
        statusFilter={statusFilter}
        priorityFilter={priorityFilter}
        assigneeFilter={assigneeFilter}
        categoryFilter={categoryFilter}
        tagFilter={tagFilter}
        deadlineFrom={deadlineFrom}
        deadlineTo={deadlineTo}
        onStatusChange={handleStatusFilterChange}
        onPriorityChange={setPriorityFilter}
        onAssigneeChange={setAssigneeFilter}
        onCategoryChange={setCategoryFilter}
        onTagChange={setTagFilter}
        onDeadlineFromChange={setDeadlineFrom}
        onDeadlineToChange={setDeadlineTo}
      />

      <div className="flex-1 flex flex-col p-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="all">Toate</TabsTrigger>
              <TabsTrigger value="todo">De facut</TabsTrigger>
              <TabsTrigger value="in-progress">In progres</TabsTrigger>
              <TabsTrigger value="done">Finalizat</TabsTrigger>
            </TabsList>

            <Button onClick={handleNewTask}>
              <Plus className="h-4 w-4 mr-2" />
              Sarcina Noua
            </Button>
          </div>

          <TabsContent value={activeTab} className="flex-1 mt-0">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <p>Nu s-au gasit sarcini</p>
                <Button variant="outline" className="mt-4" onClick={handleNewTask}>
                  Creaza prima ta sarcina
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-12rem)]">
                <div className="grid gap-4 pr-4">
                  {tasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <TaskForm
        task={null}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}
