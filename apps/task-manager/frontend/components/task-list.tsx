"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskCard } from "@/components/task-card";
import { TaskForm } from "@/components/task-form";
import { SidebarFilters } from "@/components/sidebar-filters";
import { fetchTasks, Task, TaskStatus, TaskPriority, TaskFilters } from "@/lib/api";
import { Plus, Loader2 } from "lucide-react";

export function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "ALL">("ALL");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "ALL">("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState<number | "ALL">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string | "ALL">("ALL");
  const [tagFilter, setTagFilter] = useState<string | "ALL">("ALL");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const filters: TaskFilters = {};

      // Use sidebar filter or tab filter for status
      if (statusFilter !== "ALL") {
        filters.status = statusFilter;
      } else if (activeTab !== "all") {
        filters.status = activeTab.toUpperCase().replace("-", "_") as TaskStatus;
      }

      if (priorityFilter !== "ALL") {
        filters.priority = priorityFilter;
      }

      if (assigneeFilter !== "ALL") {
        filters.assignee = assigneeFilter;
      }

      if (categoryFilter !== "ALL") {
        filters.category = categoryFilter;
      }

      if (tagFilter !== "ALL") {
        filters.tags = tagFilter;
      }

      const data = await fetchTasks(filters);
      setTasks(data);
    } catch (error) {
      console.error("Failed to load tasks:", error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, assigneeFilter, categoryFilter, tagFilter, activeTab]);

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
        onStatusChange={handleStatusFilterChange}
        onPriorityChange={setPriorityFilter}
        onAssigneeChange={setAssigneeFilter}
        onCategoryChange={setCategoryFilter}
        onTagChange={setTagFilter}
      />

      <div className="flex-1 flex flex-col p-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="all">Toate</TabsTrigger>
              <TabsTrigger value="todo">De făcut</TabsTrigger>
              <TabsTrigger value="in-progress">În progres</TabsTrigger>
              <TabsTrigger value="done">Finalizat</TabsTrigger>
            </TabsList>

            <Button onClick={handleNewTask}>
              <Plus className="h-4 w-4 mr-2" />
              Sarcină Nouă
            </Button>
          </div>

          <TabsContent value={activeTab} className="flex-1 mt-0">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <p>Nu s-au găsit sarcini</p>
                <Button variant="outline" className="mt-4" onClick={handleNewTask}>
                  Creează prima ta sarcină
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
