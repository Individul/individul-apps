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
  const [activeTab, setActiveTab] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

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

      const data = await fetchTasks(filters);
      setTasks(data);
    } catch (error) {
      console.error("Failed to load tasks:", error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, activeTab]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  function handleTaskClick(task: Task) {
    setSelectedTask(task);
    setFormOpen(true);
  }

  function handleNewTask() {
    setSelectedTask(null);
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

  const filteredTasks = tasks;

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <SidebarFilters
        statusFilter={statusFilter}
        priorityFilter={priorityFilter}
        onStatusChange={handleStatusFilterChange}
        onPriorityChange={setPriorityFilter}
      />

      <div className="flex-1 flex flex-col p-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="todo">To Do</TabsTrigger>
              <TabsTrigger value="in-progress">In Progress</TabsTrigger>
              <TabsTrigger value="done">Done</TabsTrigger>
            </TabsList>

            <Button onClick={handleNewTask}>
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </Button>
          </div>

          <TabsContent value={activeTab} className="flex-1 mt-0">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <p>No tasks found</p>
                <Button variant="outline" className="mt-4" onClick={handleNewTask}>
                  Create your first task
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-12rem)]">
                <div className="grid gap-4 pr-4">
                  {filteredTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onClick={() => handleTaskClick(task)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <TaskForm
        task={selectedTask}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}
