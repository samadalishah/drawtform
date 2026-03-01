import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/request-ip";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ownerIp = getClientIp(request);

    const workspace = await prisma.workspace.findFirst({
      where: { id, ownerIp },
      select: { id: true },
    });

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    await prisma.workspace.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete workspace error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete workspace" },
      { status: 500 }
    );
  }
}
