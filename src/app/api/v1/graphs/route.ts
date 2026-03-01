import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/request-ip";
import type { ListGraphsResponse } from "common/dto";

export async function GET(request: NextRequest) {
  try {
    const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId is required" },
        { status: 400 }
      );
    }

    const clientIp = getClientIp(request);
    const graphs = await prisma.graph.findMany({
      where: { workspaceId, workspace: { ownerIp: clientIp } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, createdAt: true },
    });
    const response: ListGraphsResponse = {
      graphs: graphs.map((g) => ({
        id: g.id,
        name: g.name,
        createdAt: g.createdAt.toISOString(),
      })),
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("List graphs error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list graphs" },
      { status: 500 }
    );
  }
}
