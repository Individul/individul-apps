import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import { ProjectStatus, Priority } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") as ProjectStatus | null
    const priority = searchParams.get("priority") as Priority | null
    const clientId = searchParams.get("clientId")

    const where: Record<string, unknown> = {}

    if (status) {
      where.status = status
    }

    if (priority) {
      where.priority = priority
    }

    if (clientId) {
      where.clientId = clientId
    }

    const projects = await prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        client: {
          select: { id: true, name: true },
        },
        _count: {
          select: { tasks: true },
        },
      },
    })

    // Transform to match frontend Project type
    const transformed = projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      priority: p.priority,
      progress: p.progress,
      startDate: p.startDate,
      endDate: p.endDate,
      typeLabel: p.typeLabel,
      durationLabel: p.durationLabel,
      tags: p.tags,
      members: p.members,
      client: p.client?.name,
      clientId: p.clientId,
      taskCount: p._count.tasks,
      tasks: [],
      // Extended details
      scopeInScope: p.scopeInScope,
      scopeOutOfScope: p.scopeOutOfScope,
      outcomes: p.outcomes,
      keyFeaturesP0: p.keyFeaturesP0,
      keyFeaturesP1: p.keyFeaturesP1,
      keyFeaturesP2: p.keyFeaturesP2,
    }))

    return NextResponse.json(transformed)
  } catch (error) {
    console.error("Failed to fetch projects:", error)
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Log received dates for debugging
    console.log("Creating project with dates:", {
      startDate: body.startDate,
      endDate: body.endDate,
      parsedStartDate: body.startDate ? new Date(body.startDate).toISOString() : null,
      parsedEndDate: body.endDate ? new Date(body.endDate).toISOString() : null,
    })

    const project = await prisma.project.create({
      data: {
        name: body.name,
        description: body.description,
        status: body.status || "planned",
        priority: body.priority || "medium",
        progress: body.progress || 0,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        typeLabel: body.typeLabel,
        durationLabel: body.durationLabel,
        tags: body.tags || [],
        members: body.members || [],
        clientId: body.clientId,
        // Extended details
        scopeInScope: body.scopeInScope || [],
        scopeOutOfScope: body.scopeOutOfScope || [],
        outcomes: body.outcomes || [],
        keyFeaturesP0: body.keyFeaturesP0 || [],
        keyFeaturesP1: body.keyFeaturesP1 || [],
        keyFeaturesP2: body.keyFeaturesP2 || [],
      },
      include: {
        client: {
          select: { id: true, name: true },
        },
      },
    })

    // Log saved dates for debugging
    console.log("Saved project dates:", {
      id: project.id,
      startDate: project.startDate?.toISOString(),
      endDate: project.endDate?.toISOString(),
    })

    return NextResponse.json(
      {
        ...project,
        client: project.client?.name,
        taskCount: 0,
        tasks: [],
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Failed to create project:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: "Failed to create project", details: errorMessage },
      { status: 500 }
    )
  }
}
