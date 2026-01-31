"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { LinkSimple, SquareHalf } from "@phosphor-icons/react/dist/ssr"
import { toast } from "sonner"
import { AnimatePresence, motion } from "motion/react"

import type { ProjectDetails, User, ProjectScope, KeyFeatures } from "@/lib/data/project-details"
import { fetchProject, updateProject, type Project } from "@/lib/api/projects"
import { getAvatarUrl } from "@/lib/assets/avatars"
import { Breadcrumbs } from "@/components/projects/Breadcrumbs"
import { ProjectHeader } from "@/components/projects/ProjectHeader"
import { ScopeColumns } from "@/components/projects/ScopeColumns"
import { OutcomesList } from "@/components/projects/OutcomesList"
import { KeyFeaturesColumns } from "@/components/projects/KeyFeaturesColumns"
import { TimelineGantt } from "@/components/projects/TimelineGantt"
import { RightMetaPanel } from "@/components/projects/RightMetaPanel"
import { WorkstreamTab } from "@/components/projects/WorkstreamTab"
import { ProjectTasksTab } from "@/components/projects/ProjectTasksTab"
import { NotesTab } from "@/components/projects/NotesTab"
import { AssetsFilesTab } from "@/components/projects/AssetsFilesTab"
import { ProjectWizard } from "@/components/project-wizard/ProjectWizard"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"

type ProjectDetailsPageProps = {
  projectId: string
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; project: ProjectDetails }
  | { status: "error"; message: string }

// Convert API Project to ProjectDetails format
function projectToDetails(p: Project): ProjectDetails {
  const picUsers: User[] = p.members.map((name) => ({
    id: name.trim().toLowerCase().replace(/\s+/g, "-"),
    name,
    avatarUrl: getAvatarUrl(name),
    role: "PIC",
  }))

  const endDate = p.endDate ? new Date(p.endDate) : new Date()

  return {
    id: p.id,
    name: p.name,
    description: p.description || (p.client ? `Project for ${p.client}.` : ""),
    meta: {
      priorityLabel: p.priority.charAt(0).toUpperCase() + p.priority.slice(1),
      locationLabel: "",
      sprintLabel: p.typeLabel && p.durationLabel ? `${p.typeLabel} ${p.durationLabel}` : p.durationLabel ?? "",
      lastSyncLabel: "Just now",
    },
    scope: {
      inScope: p.scopeInScope || [],
      outOfScope: p.scopeOutOfScope || [],
    },
    outcomes: p.outcomes || [],
    keyFeatures: {
      p0: p.keyFeaturesP0 || [],
      p1: p.keyFeaturesP1 || [],
      p2: p.keyFeaturesP2 || [],
    },
    workstreams: [],
    timelineTasks: [],
    time: {
      estimateLabel: "",
      dueDate: endDate,
      daysRemainingLabel: "",
      progressPercent: p.progress,
    },
    backlog: {
      statusLabel: p.status === "active" ? "Active" : p.status === "completed" ? "Completed" : p.status === "cancelled" ? "Cancelled" : p.status === "backlog" ? "Backlog" : "Planned",
      groupLabel: "None",
      priorityLabel: p.priority.charAt(0).toUpperCase() + p.priority.slice(1),
      labelBadge: "",
      picUsers,
      supportUsers: [],
    },
    quickLinks: [],
    files: [],
    notes: [],
    source: {
      id: p.id,
      name: p.name,
      taskCount: p.taskCount,
      progress: p.progress,
      startDate: p.startDate ? new Date(p.startDate) : undefined,
      endDate: p.endDate ? new Date(p.endDate) : undefined,
      status: p.status,
      priority: p.priority,
      tags: p.tags,
      members: p.members,
      client: p.client,
      clientId: p.clientId,
      typeLabel: p.typeLabel,
      durationLabel: p.durationLabel,
      description: p.description,
      tasks: p.tasks.map(t => ({
        id: t.id,
        name: t.name,
        assignee: t.assignee,
        status: t.status,
        startDate: t.startDate ? new Date(t.startDate) : null,
        endDate: t.endDate ? new Date(t.endDate) : null,
      })),
    },
  }
}

export function ProjectDetailsPage({ projectId }: ProjectDetailsPageProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" })
  const [showMeta, setShowMeta] = useState(true)
  const [isWizardOpen, setIsWizardOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setState({ status: "loading" })

    fetchProject(projectId)
      .then((project) => {
        if (cancelled) return
        setState({ status: "ready", project: projectToDetails(project) })
      })
      .catch((err) => {
        if (cancelled) return
        setState({ status: "error", message: err.message || "Failed to load project" })
      })

    return () => {
      cancelled = true
    }
  }, [projectId])

  const copyLink = useCallback(async () => {
    if (!navigator.clipboard) {
      toast.error("Clipboard not available")
      return
    }

    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success("Link copied")
    } catch {
      toast.error("Failed to copy link")
    }
  }, [])

  // Save handlers for editable sections
  const handleSaveScope = useCallback(async (scope: ProjectScope) => {
    try {
      await updateProject(projectId, {
        scopeInScope: scope.inScope,
        scopeOutOfScope: scope.outOfScope,
      })
      // Update local state
      if (state.status === "ready") {
        setState({
          status: "ready",
          project: {
            ...state.project,
            scope,
          },
        })
      }
      toast.success("Scope updated")
    } catch (error) {
      toast.error("Failed to update scope")
      throw error
    }
  }, [projectId, state])

  const handleSaveOutcomes = useCallback(async (outcomes: string[]) => {
    try {
      await updateProject(projectId, { outcomes })
      if (state.status === "ready") {
        setState({
          status: "ready",
          project: {
            ...state.project,
            outcomes,
          },
        })
      }
      toast.success("Outcomes updated")
    } catch (error) {
      toast.error("Failed to update outcomes")
      throw error
    }
  }, [projectId, state])

  const handleSaveKeyFeatures = useCallback(async (features: KeyFeatures) => {
    try {
      await updateProject(projectId, {
        keyFeaturesP0: features.p0,
        keyFeaturesP1: features.p1,
        keyFeaturesP2: features.p2,
      })
      if (state.status === "ready") {
        setState({
          status: "ready",
          project: {
            ...state.project,
            keyFeatures: features,
          },
        })
      }
      toast.success("Key features updated")
    } catch (error) {
      toast.error("Failed to update key features")
      throw error
    }
  }, [projectId, state])

  const breadcrumbs = useMemo(
    () => [
      { label: "Projects", href: "/" },
      { label: state.status === "ready" ? state.project.name : "Project Details" },
    ],
    [state.status, state.status === "ready" ? state.project.name : null]
  )

  const openWizard = useCallback(() => {
    setIsWizardOpen(true)
  }, [])

  const closeWizard = useCallback(() => {
    setIsWizardOpen(false)
  }, [])

  if (state.status === "loading") {
    return <ProjectDetailsSkeleton />
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-background mx-2 my-2 border border-border rounded-lg min-w-0 p-8">
        <p className="text-lg font-medium text-foreground">Project not found</p>
        <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
      </div>
    )
  }

  const project = state.project

  return (
    <div className="flex flex-1 flex-col min-w-0 m-2 border border-border rounded-lg">
      <div className="flex items-center justify-between gap-4 px-4 py-4">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="h-8 w-8 rounded-lg hover:bg-accent text-muted-foreground" />
          <div className="hidden sm:block">
            <Breadcrumbs items={breadcrumbs} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" aria-label="Copy link" onClick={copyLink}>
            <LinkSimple className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-pressed={!showMeta}
            aria-label={showMeta ? "Collapse meta panel" : "Expand meta panel"}
            className={showMeta ? "bg-muted" : ""}
            onClick={() => setShowMeta((v) => !v)}
          >
            <SquareHalf className="h-4 w-4" weight="duotone" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col bg-background px-2 my-0 rounded-b-lg min-w-0 border-t">
        <div className="px-4">
          <div className="mx-auto w-full max-w-7xl">

            <div
              className={
                "mt-0 grid grid-cols-1 gap-15 " +
                (showMeta
                  ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,320px)]"
                  : "lg:grid-cols-[minmax(0,1fr)_minmax(0,0px)]")
              }
            >
              <div className="space-y-6 pt-4">
                <ProjectHeader project={project} onEditProject={openWizard} />

                <Tabs defaultValue="overview">
                  <TabsList className="w-full gap-6">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="workstream">Workstream</TabsTrigger>
                    <TabsTrigger value="tasks">Tasks</TabsTrigger>
                    <TabsTrigger value="notes">Notes</TabsTrigger>
                    <TabsTrigger value="assets">Assets &amp; Files</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview">
                    <div className="space-y-10">
                      <p className="text-sm leading-6 text-muted-foreground">{project.description}</p>
                      <ScopeColumns scope={project.scope} onSave={handleSaveScope} editable />
                      <OutcomesList outcomes={project.outcomes} onSave={handleSaveOutcomes} editable />
                      <KeyFeaturesColumns features={project.keyFeatures} onSave={handleSaveKeyFeatures} editable />
                      <TimelineGantt tasks={project.timelineTasks} />
                    </div>
                  </TabsContent>

                  <TabsContent value="workstream">
                    <WorkstreamTab workstreams={project.workstreams} />
                  </TabsContent>

                  <TabsContent value="tasks">
                    <ProjectTasksTab project={project} />
                  </TabsContent>

                  <TabsContent value="notes">
                    <NotesTab notes={project.notes || []} />
                  </TabsContent>

                  <TabsContent value="assets">
                    <AssetsFilesTab files={project.files} />
                  </TabsContent>
                </Tabs>
              </div>

              <AnimatePresence initial={false}>
                {showMeta && (
                  <motion.div
                    key="meta-panel"
                    initial={{ x: 80, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 80, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 26 }}
                    className="lg:border-l lg:border-border lg:pl-6"
                  >
                    <RightMetaPanel project={project} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <Separator className="mt-auto" />

        {isWizardOpen && (
          <ProjectWizard onClose={closeWizard} onCreate={closeWizard} />
        )}
      </div>
    </div>
  )
}

function ProjectDetailsSkeleton() {
  return (
    <div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      <div className="p-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-48" />
        </div>

        <div className="mt-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-3 h-8 w-[360px]" />
          <Skeleton className="mt-3 h-5 w-[520px]" />
          <Skeleton className="mt-5 h-px w-full" />
          <Skeleton className="mt-5 h-16 w-full" />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-8">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>

          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-52 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
