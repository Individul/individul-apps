import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import { TaskStatus } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")
    const status = searchParams.get("status") as TaskStatus | null

    const where: Record<string, unknown> = {}

    if (projectId) {
      where.projectId = projectId
    }

    if (status) {
      where.status = status
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json(tasks)
  } catch (error) {
    console.error("Failed to fetch tasks:", error)
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      )
    }

    const task = await prisma.task.create({
      data: {
        name: body.name,
        status: body.status || "todo",
        assignee: body.assignee,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        projectId: body.projectId,
      },
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error("Failed to create task:", error)
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    )
  }
}
