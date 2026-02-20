'use client'

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { IssueList } from "@/components/tracker/issue-list"
import { Skeleton } from "@/components/ui/skeleton"

function TrackerContent() {
  const searchParams = useSearchParams()
  const initialStatus = searchParams.get('status') || undefined
  const initialCategory = searchParams.get('category') || undefined

  return (
    <main className="flex-1">
      <IssueList initialStatus={initialStatus} initialCategory={initialCategory} />
    </main>
  )
}

export default function TrackerPage() {
  return (
    <Suspense fallback={
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    }>
      <TrackerContent />
    </Suspense>
  )
}
