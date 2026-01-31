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
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      priority: project.priority,
      progress: project.progress,
      startDate: project.startDate,
      endDate: project.endDate,
      typeLabel: project.typeLabel,
      durationLabel: project.durationLabel,
      tags: project.tags,
      members: project.members,
      client: project.client?.name,
      clientId: project.clientId,
      taskCount: project.tasks.length,
      tasks: project.tasks,
      workstreams: project.workstreams,
      // Extended details
      scopeInScope: project.scopeInScope,
      scopeOutOfScope: project.scopeOutOfScope,
      outcomes: project.outcomes,
      keyFeaturesP0: project.keyFeaturesP0,
      keyFeaturesP1: project.keyFeaturesP1,
      keyFeaturesP2: project.keyFeaturesP2,
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

    // Build update data, only including fields that are present
    const updateData: Record<string, unknown> = {}

    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.status !== undefined) updateData.status = body.status
    if (body.priority !== undefined) updateData.priority = body.priority
    if (body.progress !== undefined) updateData.progress = body.progress
    if (body.startDate !== undefined) updateData.startDate = body.startDate ? new Date(body.startDate) : null
    if (body.endDate !== undefined) updateData.endDate = body.endDate ? new Date(body.endDate) : null
    if (body.typeLabel !== undefined) updateData.typeLabel = body.typeLabel
    if (body.durationLabel !== undefined) updateData.durationLabel = body.durationLabel
    if (body.tags !== undefined) updateData.tags = body.tags
    if (body.members !== undefined) updateData.members = body.members
    if (body.clientId !== undefined) updateData.clientId = body.clientId
    // Extended details
    if (body.scopeInScope !== undefined) updateData.scopeInScope = body.scopeInScope
    if (body.scopeOutOfScope !== undefined) updateData.scopeOutOfScope = body.scopeOutOfScope
    if (body.outcomes !== undefined) updateData.outcomes = body.outcomes
    if (body.keyFeaturesP0 !== undefined) updateData.keyFeaturesP0 = body.keyFeaturesP0
    if (body.keyFeaturesP1 !== undefined) updateData.keyFeaturesP1 = body.keyFeaturesP1
    if (body.keyFeaturesP2 !== undefined) updateData.keyFeaturesP2 = body.keyFeaturesP2

    const project = await prisma.project.update({
      where: { id },
      data: updateData,
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
