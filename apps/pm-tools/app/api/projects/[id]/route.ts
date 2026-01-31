import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        client: {
          select: { id: true, name: true },
        },
        tasks: {
          orderBy: { createdAt: "asc" },
        },
        workstreams: {
          orderBy: { createdAt: "asc" },
        },
      },
    })

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ...project,
      client: project.client?.name,
      clientId: project.clientId,
      taskCount: project.tasks.length,
    })
  } catch (error) {
    console.error("Failed to fetch project:", error)
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()

    const project = await prisma.project.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        status: body.status,
        priority: body.priority,
        progress: body.progress,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        typeLabel: body.typeLabel,
        durationLabel: body.durationLabel,
        tags: body.tags,
        members: body.members,
        clientId: body.clientId,
      },
      include: {
        client: {
          select: { id: true, name: true },
        },
        _count: {
          select: { tasks: true },
        },
      },
    })

    return NextResponse.json({
      ...project,
      client: project.client?.name,
      taskCount: project._count.tasks,
      tasks: [],
    })
  } catch (error) {
    console.error("Failed to update project:", error)
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    await prisma.project.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete project:", error)
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    )
  }
}
