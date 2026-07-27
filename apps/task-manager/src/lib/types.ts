export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";
export type Role = "admin" | "member";

export interface Profile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role: Role;
}
export interface Tag {
  id: string;
  name: string;
  color: string;
}
export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assignee_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  assignee?: Profile | null;
  tags?: Tag[];
}
export interface Comment {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author?: Profile;
}
export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  done: boolean;
  position: number;
  done_at: string | null;
  created_at: string;
}
export interface AuditEntry {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  entity: "tasks" | "comments" | "tags" | "task_tags" | "profiles";
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}
export type NotificationType = "assigned" | "comment" | "status" | "edited" | "deleted";
export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  task_id: string | null;
  actor_id: string | null;
  actor_name: string | null;
  message: string;
  read: boolean;
  created_at: string;
}
