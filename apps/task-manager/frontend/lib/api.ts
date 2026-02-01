const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";
export type ActivityAction = "CREATED" | "UPDATED" | "STATUS_CHANGED" | "PRIORITY_CHANGED" | "ASSIGNED" | "UNASSIGNED" | "COMMENT";

export interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
}

export interface TaskActivity {
  id: string;
  action: ActivityAction;
  action_display: string;
  user: number | null;
  user_details: User | null;
  details: Record<string, string | number | null>;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: string;
  tags: string[];
  deadline: string | null;
  assignee: number | null;
  assignee_details: User | null;
  created_at: string;
  updated_at: string;
}

export interface TaskDetail extends Task {
  activities: TaskActivity[];
}

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  category?: string;
  assignee?: number;
  tags?: string;
  ordering?: string;
  search?: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  category?: string;
  tags?: string[];
  deadline?: string | null;
  assignee?: number | null;
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export async function fetchUsers(): Promise<User[]> {
  const response = await fetch(`${API_URL}/users/`, {
    cache: "no-store",
  });
  return handleResponse<User[]>(response);
}

export async function fetchCategories(): Promise<string[]> {
  const response = await fetch(`${API_URL}/categories/`, {
    cache: "no-store",
  });
  return handleResponse<string[]>(response);
}

export async function fetchTags(): Promise<string[]> {
  const response = await fetch(`${API_URL}/tags/`, {
    cache: "no-store",
  });
  return handleResponse<string[]>(response);
}

export async function fetchTasks(filters?: TaskFilters): Promise<Task[]> {
  const params = new URLSearchParams();

  if (filters?.status) params.append("status", filters.status);
  if (filters?.priority) params.append("priority", filters.priority);
  if (filters?.category) params.append("category", filters.category);
  if (filters?.assignee) params.append("assignee", filters.assignee.toString());
  if (filters?.tags) params.append("tags", filters.tags);
  if (filters?.ordering) params.append("ordering", filters.ordering);
  if (filters?.search) params.append("search", filters.search);

  const queryString = params.toString();
  const url = `${API_URL}/tasks/${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, {
    cache: "no-store",
  });

  const data = await handleResponse<{ results?: Task[] } | Task[]>(response);
  return Array.isArray(data) ? data : data.results || [];
}

export async function fetchTask(id: string): Promise<TaskDetail> {
  const response = await fetch(`${API_URL}/tasks/${id}/`, {
    cache: "no-store",
  });
  return handleResponse<TaskDetail>(response);
}

export async function createTask(data: CreateTaskInput): Promise<Task> {
  const response = await fetch(`${API_URL}/tasks/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return handleResponse<Task>(response);
}

export async function updateTask(id: string, data: UpdateTaskInput): Promise<Task> {
  const response = await fetch(`${API_URL}/tasks/${id}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return handleResponse<Task>(response);
}

export async function deleteTask(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/tasks/${id}/`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
}

export async function addComment(taskId: string, comment: string, userId?: number): Promise<TaskActivity> {
  const response = await fetch(`${API_URL}/tasks/${taskId}/comment/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ comment, user_id: userId }),
  });
  return handleResponse<TaskActivity>(response);
}
