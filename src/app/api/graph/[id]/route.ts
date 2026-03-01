import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { GetGraphResponse } from "common/dto";
import type { GraphDto } from "common/dto";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const graph = await prisma.graph.findUnique({
      where: { id },
      include: {
        nodes: true,
        edges: true,
      },
    });
    if (!graph) {
      return NextResponse.json({ graph: null } satisfies GetGraphResponse);
    }
    const dto: GraphDto = {
      id: graph.id,
      name: graph.name,
      nodes: graph.nodes.map((n) => ({
        id: n.id,
        label: n.label,
        kind: n.kind as GraphDto["nodes"][0]["kind"],
        resourceType: n.resourceType ?? undefined,
        thumbnailKey: n.thumbnailKey ?? undefined,
        cloudProvider: (n.cloudProvider as GraphDto["nodes"][0]["cloudProvider"]) ?? undefined,
        source: n.source ?? undefined,
        metadata: (n.metadata as Record<string, unknown>) ?? undefined,
      })),
      edges: graph.edges.map((e) => ({
        id: e.id,
        sourceId: e.sourceId,
        targetId: e.targetId,
        label: e.label ?? undefined,
      })),
      createdAt: graph.createdAt.toISOString(),
    };
    const response: GetGraphResponse = { graph: dto };
    return NextResponse.json(response);
  } catch (err) {
    console.error("Get graph error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get graph" },
      { status: 500 }
    );
  }
}
