import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import { ClientStatus } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") as ClientStatus | null
    const search = searchParams.get("search")

    const where: Record<string, unknown> = {}

    if (status) {
      where.status = status
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { primaryContactName: { contains: search, mode: "insensitive" } },
        { primaryContactEmail: { contains: search, mode: "insensitive" } },
      ]
    }

    const clients = await prisma.client.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { projects: true },
        },
      },
    })

    return NextResponse.json(clients)
  } catch (error) {
    console.error("Failed to fetch clients:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: "Failed to fetch clients", details: errorMessage },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const client = await prisma.client.create({
      data: {
        name: body.name,
        status: body.status || "active",
        industry: body.industry,
        website: body.website,
        location: body.location,
        owner: body.owner,
        primaryContactName: body.primaryContactName,
        primaryContactEmail: body.primaryContactEmail,
        notes: body.notes,
        segment: body.segment,
      },
    })

    return NextResponse.json(client, { status: 201 })
  } catch (error) {
    console.error("Failed to create client:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: "Failed to create client", details: errorMessage },
      { status: 500 }
    )
  }
}
