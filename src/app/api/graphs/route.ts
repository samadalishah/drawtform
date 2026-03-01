import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ListGraphsResponse } from "common/dto";

export async function GET() {
  try {
    const graphs = await prisma.graph.findMany({
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
