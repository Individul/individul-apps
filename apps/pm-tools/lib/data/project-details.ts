import type { Project as ProjectListItem } from "@/lib/data/projects"
import { projects } from "@/lib/data/projects"
import { getAvatarUrl } from "@/lib/assets/avatars"

function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

export type User = {
  id: string
  name: string
  avatarUrl?: string
  role?: string
}

export type ProjectMeta = {
  priorityLabel: string
  locationLabel: string
  sprintLabel: string
  lastSyncLabel: string
}

export type ProjectScope = {
  inScope: string[]
  outOfScope: string[]
}

export type KeyFeatures = {
  p0: string[]
  p1: string[]
  p2: string[]
}

export type TimelineTask = {
  id: string
  name: string
  startDate: Date
  endDate: Date
  status: "planned" | "in-progress" | "done"
}

export type WorkstreamTaskStatus = "todo" | "in-progress" | "done"

export type WorkstreamTask = {
  id: string
  name: string
  status: WorkstreamTaskStatus
  dueLabel?: string
  dueTone?: "danger" | "warning" | "muted"
  assignee?: User
  /** Optional start date for the task (used in task views). */
  startDate?: Date
  /** Optional priority identifier for the task. */
  priority?: "no-priority" | "low" | "medium" | "high" | "urgent"
  /** Optional tag label for the task (e.g. Feature, Bug). */
  tag?: string
  /** Optional short description used in task lists. */
  description?: string
}

export type WorkstreamGroup = {
  id: string
  name: string
  tasks: WorkstreamTask[]
}

export type ProjectTask = WorkstreamTask & {
  projectId: string
  projectName: string
  workstreamId: string
  workstreamName: string
}

export type TimeSummary = {
  estimateLabel: string
  dueDate: Date
  daysRemainingLabel: string
  progressPercent: number
}

export type BacklogSummary = {
  statusLabel: "Active" | "Backlog" | "Planned" | "Completed" | "Cancelled"
  groupLabel: string
  priorityLabel: string
  labelBadge: string
  picUsers: User[]
  supportUsers?: User[]
}

export type QuickLink = {
  id: string
  name: string
  type: "pdf" | "zip" | "fig" | "doc" | "file"
  sizeMB: number
  url: string
}

export type ProjectFile = QuickLink & {
  addedBy: User
  addedDate: Date
  description?: string
  isLinkAsset?: boolean
  attachments?: QuickLink[]
}

export type NoteType = "general" | "meeting" | "audio"
export type NoteStatus = "completed" | "processing"

export type TranscriptSegment = {
  id: string
  speaker: string
  timestamp: string
  text: string
}

export type AudioNoteData = {
  duration: string
  fileName: string
  aiSummary: string
  keyPoints: string[]
  insights: string[]
  transcript: TranscriptSegment[]
}

export type ProjectNote = {
  id: string
  title: string
  content?: string
  noteType: NoteType
  status: NoteStatus
  addedDate: Date
  addedBy: User
  audioData?: AudioNoteData
}

export type ProjectDetails = {
  id: string
  name: string
  description: string
  meta: ProjectMeta
  scope: ProjectScope
  outcomes: string[]
  keyFeatures: KeyFeatures
  timelineTasks: TimelineTask[]
  workstreams: WorkstreamGroup[]
  time: TimeSummary
  backlog: BacklogSummary
  quickLinks: QuickLink[]
  files: ProjectFile[]
  notes: ProjectNote[]
  source?: ProjectListItem
}

export function getProjectTasks(details: ProjectDetails): ProjectTask[] {
  const workstreams = details.workstreams ?? []

  return workstreams.flatMap((group) =>
    group.tasks.map((task) => ({
      ...task,
      projectId: details.id,
      projectName: details.name,
      workstreamId: group.id,
      workstreamName: group.name,
    })),
  )
}

function userFromName(name: string, role?: string): User {
  return {
    id: name.trim().toLowerCase().replace(/\s+/g, "-"),
    name,
    avatarUrl: getAvatarUrl(name),
    role,
  }
}

function baseDetailsFromListItem(p: ProjectListItem): ProjectDetails {
  const picUsers = p.members.length ? p.members.map((n) => userFromName(n, "PIC")) : []

  return {
    id: p.id,
    name: p.name,
    description: p.client ? `Project for ${p.client}.` : "",
    meta: {
      priorityLabel: p.priority.charAt(0).toUpperCase() + p.priority.slice(1),
      locationLabel: "",
      sprintLabel: p.typeLabel && p.durationLabel ? `${p.typeLabel} ${p.durationLabel}` : p.durationLabel ?? "",
      lastSyncLabel: "Just now",
    },
    scope: {
      inScope: [],
      outOfScope: [],
    },
    outcomes: [],
    keyFeatures: {
      p0: [],
      p1: [],
      p2: [],
    },
    workstreams: [],
    timelineTasks: [],
    time: {
      estimateLabel: "",
      dueDate: p.endDate,
      daysRemainingLabel: "",
      progressPercent: p.progress,
    },
    backlog: {
      statusLabel: "Active",
      groupLabel: "None",
      priorityLabel: p.priority.charAt(0).toUpperCase() + p.priority.slice(1),
      labelBadge: "",
      picUsers,
      supportUsers: [],
    },
    quickLinks: [],
    files: [],
    notes: [],
    source: p,
  }
}

export function getProjectDetailsById(id: string): ProjectDetails {
  const base = projects.find((p) => p.id === id)

  const effectiveBase: ProjectListItem =
    base ?? {
      id,
      name: `Untitled project ${id}`,
      taskCount: 0,
      progress: 0,
      startDate: new Date(),
      endDate: new Date(),
      status: "planned",
      priority: "medium",
      tags: [],
      members: [],
      tasks: [],
    }

  return baseDetailsFromListItem(effectiveBase)
}
