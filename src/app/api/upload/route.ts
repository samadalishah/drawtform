import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { parseTerraformFiles } from "@/lib/tf-parser";
import { buildDagFromParsed } from "@/lib/dag";
import { prisma } from "@/lib/prisma";
import type { UploadTerraformResponse } from "common/dto";

const MAX_ZIP_SIZE = 10 * 1024 * 1024; // 10MB
const TF_EXT = /\.tf$/i;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const name = (formData.get("name") as string) || "Terraform modules";

    if (!file) {
      return NextResponse.json(
        { error: "Missing file. Upload a zip of Terraform modules." },
        { status: 400 }
      );
    }

    if (file.size > MAX_ZIP_SIZE) {
      return NextResponse.json(
        { error: "File too large. Max 10MB." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const zip = await JSZip.loadAsync(buffer);
    const files: { path: string; content: string }[] = [];

    for (const [path, entry] of Object.entries(zip.files)) {
      if (entry.dir || !TF_EXT.test(path)) continue;
      const content = await entry.async("string");
      files.push({ path, content });
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No .tf files found in the zip." },
        { status: 400 }
      );
    }

    const parsed = parseTerraformFiles(files);
    const envName = name.trim() || "main";
    const dag = buildDagFromParsed(parsed, envName);

    if (dag.nodes.length <= 1) {
      return NextResponse.json(
        { error: "Terraform files were found, but no module/resource/provider/data blocks were parsed." },
        { status: 400 }
      );
    }

    const graph = await prisma.graph.create({
      data: { name: envName },
    });

    const externalIdToDbId = new Map<string, string>();

    for (const n of dag.nodes) {
      const node = await prisma.graphNode.create({
        data: {
          graphId: graph.id,
          externalId: n.externalId,
          label: n.label,
          kind: n.kind,
          resourceType: n.resourceType ?? null,
          thumbnailKey: n.thumbnailKey,
          cloudProvider: n.cloudProvider ?? null,
          source: n.source ?? null,
          metadata: (n.metadata ?? {}) as object,
        },
      });
      externalIdToDbId.set(n.externalId, node.id);
    }

    for (const e of dag.edges) {
      const sourceDbId = externalIdToDbId.get(e.sourceId);
      const targetDbId = externalIdToDbId.get(e.targetId);
      if (sourceDbId && targetDbId) {
        await prisma.graphEdge.create({
          data: {
            graphId: graph.id,
            sourceId: sourceDbId,
            targetId: targetDbId,
            label: e.label ?? null,
          },
        });
      }
    }

    const response: UploadTerraformResponse = {
      graphId: graph.id,
      message: `Parsed ${files.length} .tf file(s), created graph with ${dag.nodes.length} nodes and ${dag.edges.length} edges.`,
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
