import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        projects: {
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(client)
  } catch (error) {
    console.error("Failed to fetch client:", error)
    return NextResponse.json(
      { error: "Failed to fetch client" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()

    const client = await prisma.client.update({
      where: { id },
      data: {
        name: body.name,
        status: body.status,
        industry: body.industry,
        website: body.website,
        location: body.location,
        owner: body.owner,
        primaryContactName: body.primaryContactName,
        primaryContactEmail: body.primaryContactEmail,
        notes: body.notes,
        segment: body.segment,
        lastActivityLabel: body.lastActivityLabel,
      },
    })

    return NextResponse.json(client)
  } catch (error) {
    console.error("Failed to update client:", error)
    return NextResponse.json(
      { error: "Failed to update client" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    await prisma.client.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete client:", error)
    return NextResponse.json(
      { error: "Failed to delete client" },
      { status: 500 }
    )
  }
}
