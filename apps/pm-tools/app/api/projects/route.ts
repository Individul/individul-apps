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
      },
      include: {
        client: {
          select: { id: true, name: true },
        },
      },
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
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    )
  }
}
