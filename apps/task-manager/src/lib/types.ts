export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";
export type Role = "admin" | "member";

export interface Profile {
  id: string;
  full_name: string | null;
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
