import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/request-ip";
import type { CreateWorkspaceResponse, ListWorkspacesResponse } from "common/dto";

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const workspaces = await prisma.workspace.findMany({
      where: { ownerIp: ip },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, createdAt: true, updatedAt: true },
    });

    const response: ListWorkspacesResponse = {
      workspaces: workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        createdAt: w.createdAt.toISOString(),
        updatedAt: w.updatedAt.toISOString(),
      })),
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("List workspaces error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list workspaces" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { name?: string };
    const name = (body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "Workspace name is required." }, { status: 400 });
    }

    const ip = getClientIp(request);
    const workspace = await prisma.workspace.create({
      data: {
        name,
        ownerIp: ip,
      },
      select: { id: true, name: true, createdAt: true, updatedAt: true },
    });

    const response: CreateWorkspaceResponse = {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        createdAt: workspace.createdAt.toISOString(),
        updatedAt: workspace.updatedAt.toISOString(),
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    console.error("Create workspace error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create workspace" },
      { status: 500 }
    );
  }
}
