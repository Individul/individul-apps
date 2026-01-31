import { NextResponse } from "next/server"
import prisma from "@/lib/db"

export async function GET() {
  try {
    // Get a sample of recent projects with their dates for debugging
    const recentProjects = await prisma.project.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      message: "PM Tools API is running",
      debug: {
        recentProjects: recentProjects.map(p => ({
          id: p.id,
          name: p.name,
          startDate: p.startDate?.toISOString() ?? null,
          endDate: p.endDate?.toISOString() ?? null,
          createdAt: p.createdAt.toISOString(),
        })),
      },
    })
  } catch (error) {
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      message: "PM Tools API is running",
      debug: { error: error instanceof Error ? error.message : "Unknown error" },
    })
  }
}
