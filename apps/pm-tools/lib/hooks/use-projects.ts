"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Project,
  ProjectStatus,
  Priority,
  CreateProjectInput,
  UpdateProjectInput,
  fetchProjects,
  createProject as apiCreateProject,
  updateProject as apiUpdateProject,
  deleteProject as apiDeleteProject,
} from "@/lib/api/projects"

export type UseProjectsOptions = {
  status?: ProjectStatus
  priority?: Priority
  clientId?: string
}

export function useProjects(options?: UseProjectsOptions) {
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const loadProjects = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await fetchProjects(options)
      // Convert string dates to Date objects for frontend compatibility
      const transformed = data.map((p) => ({
        ...p,
        startDate: p.startDate ? new Date(p.startDate) : undefined,
        endDate: p.endDate ? new Date(p.endDate) : undefined,
      }))
      setProjects(transformed)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch projects"))
    } finally {
      setIsLoading(false)
    }
  }, [options?.status, options?.priority, options?.clientId])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const createProject = useCallback(
    async (input: CreateProjectInput) => {
      const newProject = await apiCreateProject(input)
      const transformed = {
        ...newProject,
        startDate: newProject.startDate ? new Date(newProject.startDate) : undefined,
        endDate: newProject.endDate ? new Date(newProject.endDate) : undefined,
      }
      setProjects((prev) => [transformed, ...prev])
      return transformed
    },
    []
  )

  const updateProject = useCallback(
    async (id: string, input: UpdateProjectInput) => {
      const updated = await apiUpdateProject(id, input)
      const transformed = {
        ...updated,
        startDate: updated.startDate ? new Date(updated.startDate) : undefined,
        endDate: updated.endDate ? new Date(updated.endDate) : undefined,
      }
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...transformed } : p))
      )
      return transformed
    },
    []
  )

  const deleteProject = useCallback(async (id: string) => {
    await apiDeleteProject(id)
    setProjects((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const refresh = useCallback(() => {
    loadProjects()
  }, [loadProjects])

  return {
    projects,
    isLoading,
    error,
    createProject,
    updateProject,
    deleteProject,
    refresh,
  }
}
