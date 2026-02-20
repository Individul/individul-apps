"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IssueForm } from "@/components/tracker/issue-form"
import { IssueStatusBadge, IssuePriorityBadge, IssueCategoryBadge } from "@/components/tracker/issue-badges"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TrackerIssue, trackerApi, TRACKER_CATEGORIES, TRACKER_PRIORITIES } from "@/lib/api"
import { formatDateTime } from "@/lib/utils"
import { Plus, Loader2, Search, Bug, Lightbulb, Layers } from "lucide-react"
import Link from "next/link"

interface IssueListProps {
  initialStatus?: string
  initialCategory?: string
}

export function IssueList({ initialStatus, initialCategory }: IssueListProps) {
  const [issues, setIssues] = useState<TrackerIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>(initialStatus || "all")
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory || "ALL")
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL")
  const [search, setSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)

  const loadIssues = useCallback(async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem("access_token")
      if (!token) return

      const params = new URLSearchParams()

      if (activeTab !== "all") {
        params.append("status", activeTab)
      }
      if (categoryFilter !== "ALL") {
        params.append("category", categoryFilter)
      }
      if (priorityFilter !== "ALL") {
        params.append("priority", priorityFilter)
      }
      if (search.trim()) {
        params.append("search", search.trim())
      }

      const data = await trackerApi.list(token, params)
      setIssues(data.results)
    } catch (error) {
      console.error("Failed to load issues:", error)
    } finally {
      setLoading(false)
    }
  }, [activeTab, categoryFilter, priorityFilter, search])

  useEffect(() => {
    loadIssues()
  }, [loadIssues])

  function handleFormSuccess() {
    loadIssues()
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Tracker SIA</h1>
            <p className="text-sm text-slate-500 mt-1">Bug-uri, propuneri și cerințe noi</p>
          </div>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Problemă nouă
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Caută..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Categorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toate categoriile</SelectItem>
              {TRACKER_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Prioritate" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toate</SelectItem>
              {TRACKER_PRIORITIES.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 px-6 pb-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col h-full">
          <TabsList>
            <TabsTrigger value="all">Toate</TabsTrigger>
            <TabsTrigger value="NOU">Noi</TabsTrigger>
            <TabsTrigger value="IN_LUCRU">În lucru</TabsTrigger>
            <TabsTrigger value="TESTAT">Testate</TabsTrigger>
            <TabsTrigger value="IMPLEMENTAT">Implementate</TabsTrigger>
            <TabsTrigger value="RESPINS">Respinse</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="flex-1 mt-4">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : issues.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Layers className="h-12 w-12 mb-3 text-slate-300" />
                <p>Nu s-au găsit probleme</p>
                <Button variant="outline" className="mt-4" onClick={() => setFormOpen(true)}>
                  Raportează prima problemă
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-18rem)]">
                <div className="grid gap-3 pr-4">
                  {issues.map((issue) => (
                    <Link key={issue.id} href={`/tracker/${issue.id}`}>
                      <Card className="cursor-pointer hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base font-medium line-clamp-1">
                            {issue.title}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <IssueStatusBadge status={issue.status} />
                            <IssuePriorityBadge priority={issue.priority} />
                            <IssueCategoryBadge category={issue.category} />
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {issue.module_name && (
                              <span className="flex items-center gap-1">
                                <Layers className="h-3 w-3" />
                                {issue.module_name}
                              </span>
                            )}
                            <span>{formatDateTime(issue.created_at)}</span>
                            {issue.created_by_name && (
                              <span>{issue.created_by_name}</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <IssueForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={handleFormSuccess}
      />
    </div>
  )
}
