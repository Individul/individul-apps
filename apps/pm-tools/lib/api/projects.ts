import { api } from "./client"

export type ProjectStatus = "backlog" | "planned" | "active" | "cancelled" | "completed"
export type Priority = "urgent" | "high" | "medium" | "low"
export type TaskStatus = "todo" | "in_progress" | "done"

export type Task = {
  id: string
  name: string
  status: TaskStatus
  assignee?: string | null
  startDate?: string | null
  endDate?: string | null
  projectId: string
}

export type Project = {
  id: string
  name: string
  description?: string | null
  status: ProjectStatus
  priority: Priority
  progress: number
  startDate?: string | Date | null
  endDate?: string | Date | null
  typeLabel?: string | null
  durationLabel?: string | null
  tags: string[]
  members: string[]
  client?: string | null
  clientId?: string | null
  taskCount: number
  tasks: Task[]
  // Extended details
  scopeInScope?: string[]
  scopeOutOfScope?: string[]
  outcomes?: string[]
  keyFeaturesP0?: string[]
  keyFeaturesP1?: string[]
  keyFeaturesP2?: string[]
}

export type CreateProjectInput = {
  name: string
  description?: string
  status?: ProjectStatus
  priority?: Priority
  progress?: number
  startDate?: string | Date
  endDate?: string | Date
  typeLabel?: string
  durationLabel?: string
  tags?: string[]
  members?: string[]
  clientId?: string
}

export type UpdateProjectInput = Partial<CreateProjectInput>

export async function fetchProjects(params?: {
  status?: ProjectStatus
  priority?: Priority
  clientId?: string
}): Promise<Project[]> {
  const searchParams = new URLSearchParams()
  if (params?.status) searchParams.set("status", params.status)
  if (params?.priority) searchParams.set("priority", params.priority)
  if (params?.clientId) searchParams.set("clientId", params.clientId)

  const query = searchParams.toString()
  const endpoint = `/projects${query ? `?${query}` : ""}`

  return api.get<Project[]>(endpoint)
}

export async function fetchProject(id: string): Promise<Project> {
  return api.get<Project>(`/projects/${id}`)
}

export async function createProject(data: CreateProjectInput): Promise<Project> {
  return api.post<Project>("/projects", data)
}

export async function updateProject(
  id: string,
  data: UpdateProjectInput
): Promise<Project> {
  return api.put<Project>(`/projects/${id}`, data)
}

export async function deleteProject(id: string): Promise<void> {
  await api.delete(`/projects/${id}`)
}
