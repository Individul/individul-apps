import { Badge } from "@/components/ui/badge"
import { TrackerIssue } from "@/lib/api"

type IssueStatus = TrackerIssue["status"]
type IssuePriority = TrackerIssue["priority"]
type IssueCategory = TrackerIssue["category"]

export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  switch (status) {
    case "NOU":
      return <Badge className="bg-blue-100 text-blue-700 border-transparent">Nou</Badge>
    case "IN_LUCRU":
      return <Badge className="bg-orange-100 text-orange-700 border-transparent">În lucru</Badge>
    case "TESTAT":
      return <Badge className="bg-purple-100 text-purple-700 border-transparent">Testat</Badge>
    case "IMPLEMENTAT":
      return <Badge className="bg-green-100 text-green-700 border-transparent">Implementat</Badge>
    case "RESPINS":
      return <Badge className="bg-red-100 text-red-700 border-transparent">Respins</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

export function IssuePriorityBadge({ priority }: { priority: IssuePriority }) {
  switch (priority) {
    case "CRITIC":
      return <Badge className="bg-red-100 text-red-700 border-transparent">Critic</Badge>
    case "INALT":
      return <Badge className="bg-orange-100 text-orange-700 border-transparent">Înalt</Badge>
    case "MEDIU":
      return <Badge className="bg-yellow-100 text-yellow-700 border-transparent">Mediu</Badge>
    case "SCAZUT":
      return <Badge className="bg-green-100 text-green-700 border-transparent">Scăzut</Badge>
    default:
      return <Badge variant="secondary">{priority}</Badge>
  }
}

export function IssueCategoryBadge({ category }: { category: IssueCategory }) {
  switch (category) {
    case "BUG_CRITIC":
      return <Badge className="bg-red-50 text-red-600 border-red-200">Bug critic</Badge>
    case "BUG_MINOR":
      return <Badge className="bg-orange-50 text-orange-600 border-orange-200">Bug minor</Badge>
    case "PROPUNERE":
      return <Badge className="bg-blue-50 text-blue-600 border-blue-200">Propunere</Badge>
    case "CERINTA_NOUA":
      return <Badge className="bg-green-50 text-green-600 border-green-200">Cerință nouă</Badge>
    default:
      return <Badge variant="secondary">{category}</Badge>
  }
}
