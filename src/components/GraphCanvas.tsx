"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ConnectionLineType,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  type ReactFlowInstance,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ResourceThumbnail } from "./ResourceThumbnail";
import type { GraphNodeDto, GraphEdgeDto } from "common/dto";

interface FlowNodeData {
  label: string;
  kind: string;
  thumbnailKey?: string;
  node: GraphNodeDto;
  isHighlighted: boolean;
}

function GraphNodeCard({ data }: NodeProps) {
  const d = (data ?? {}) as Partial<FlowNodeData>;
  const label = d.label ?? "";
  const kind = d.kind ?? "default";
  const thumbnailKey = d.thumbnailKey;
  const isStart = kind === "env";
  const isHighlighted = Boolean(d.isHighlighted);

  return (
    <div
      className={[
        "relative overflow-hidden border bg-white/95 backdrop-blur transition-all",
        "rounded-xl",
        isStart
          ? "border-cyan-500 shadow-[0_0_0_2px_rgba(6,182,212,0.25),0_14px_30px_-12px_rgba(14,116,144,0.45)]"
          : "border-slate-200/80 shadow-[0_12px_28px_-14px_rgba(15,23,42,0.45)]",
        isHighlighted ? "ring-2 ring-amber-400" : "",
      ].join(" ")}
    >
      {isStart && (
        <span className="absolute left-2 top-2 z-10 rounded-md border border-cyan-700 bg-cyan-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Start
        </span>
      )}
      <Handle type="target" position={Position.Top} className="!h-2.5 !w-2.5 !bg-slate-500" />
      <ResourceThumbnail thumbnailKey={thumbnailKey} label={label} kind={kind} className="border-0 shadow-none" />
      <Handle type="source" position={Position.Bottom} className="!h-2.5 !w-2.5 !bg-slate-500" />
    </div>
  );
}

const nodeTypes = { tfNode: GraphNodeCard };

function resourcePurpose(resourceType?: string): string {
  if (!resourceType) return "Infrastructure element used by the Terraform stack.";
  if (resourceType.startsWith("aws_vpc")) return "Provides isolated network boundaries for workloads.";
  if (resourceType.startsWith("aws_subnet")) return "Segments the VPC network into deployable zones/subnets.";
  if (resourceType.startsWith("aws_security_group")) return "Controls inbound and outbound traffic rules.";
  if (resourceType.startsWith("aws_ecs_cluster")) return "Hosts and orchestrates container services.";
  if (resourceType.startsWith("aws_ecs_service")) return "Runs and maintains desired container task count.";
  if (resourceType.startsWith("aws_ecs_task_definition")) return "Defines container runtime settings and image references.";
  if (resourceType.startsWith("aws_elasticache")) return "Provides managed in-memory caching/data store.";
  if (resourceType.startsWith("aws_sqs_queue")) return "Provides asynchronous message buffering between services.";
  if (resourceType.startsWith("aws_iam_role")) return "Defines AWS permissions for service or task identity.";
  if (resourceType.startsWith("aws_lb")) return "Distributes network traffic to backend services.";
  if (resourceType.startsWith("aws_instance")) return "Represents a compute instance used by workloads.";
  return "Infrastructure element used by the Terraform stack.";
}

function explainNode(node: GraphNodeDto, incoming: GraphNodeDto[], outgoing: GraphNodeDto[]) {
  const usedBy = outgoing.map((n) => n.label);
  const dependsOn = incoming.map((n) => n.label);

  if (node.kind === "env") {
    return {
      what: "This is the environment root node for a deployment scope.",
      usedFor: "It groups all infrastructure components for a specific environment.",
      how: usedBy.length
        ? `In this graph it fans out to: ${usedBy.slice(0, 8).join(", ")}${usedBy.length > 8 ? "..." : ""}.`
        : "In this graph it acts as the starting anchor for related resources.",
    };
  }

  if (node.kind === "module") {
    return {
      what: "This is a Terraform module invocation node.",
      usedFor: "It packages reusable infrastructure logic across environments.",
      how:
        dependsOn.length || usedBy.length
          ? `It depends on ${dependsOn.length || 0} node(s) and drives ${usedBy.length || 0} downstream node(s).`
          : "It currently has no explicit graph dependencies in parsed references.",
    };
  }

  if (node.kind === "provider") {
    return {
      what: "This is a Terraform provider node.",
      usedFor: "It enables Terraform to create and manage resources for the cloud platform.",
      how: dependsOn.length
        ? `Referenced by ${dependsOn.length} node(s) in this graph.`
        : "Acts as a foundational dependency for resource operations.",
    };
  }

  if (node.kind === "data") {
    return {
      what: "This is a Terraform data source node.",
      usedFor: "It reads existing infrastructure information at plan/apply time.",
      how:
        usedBy.length
          ? `Its values are consumed by: ${usedBy.slice(0, 8).join(", ")}${usedBy.length > 8 ? "..." : ""}.`
          : "It provides lookup values for other resources when referenced.",
    };
  }

  return {
    what: `This is a Terraform resource node${node.resourceType ? ` (${node.resourceType})` : ""}.`,
    usedFor: resourcePurpose(node.resourceType),
    how:
      dependsOn.length || usedBy.length
        ? `It depends on ${dependsOn.length || 0} node(s) and is used by ${usedBy.length || 0} node(s).`
        : "It is a standalone resource in the parsed dependency graph.",
  };
}

function toFlowEdges(edges: GraphEdgeDto[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.sourceId,
    target: e.targetId,
    type: "smoothstep",
    animated: false,
    style: { stroke: "#64748b", strokeWidth: 1.5 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: "#64748b",
      width: 16,
      height: 16,
    },
  }));
}

interface GraphCanvasProps {
  nodes: GraphNodeDto[];
  edges: GraphEdgeDto[];
}

function layoutNodes(nodes: GraphNodeDto[], edges: GraphEdgeDto[]): Node[] {
  if (nodes.length === 0) return [];

  const nodeById = new Map(nodes.map((n) => [n.id, n] as const));
  const outgoing = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  const level = new Map<string, number>();
  const childrenMaxLevel = new Map<string, number>();

  for (const n of nodes) {
    outgoing.set(n.id, []);
    indegree.set(n.id, 0);
    level.set(n.id, n.kind === "env" ? 0 : 1);
    childrenMaxLevel.set(n.id, 0);
  }

  for (const e of edges) {
    if (!nodeById.has(e.sourceId) || !nodeById.has(e.targetId)) continue;
    outgoing.get(e.sourceId)?.push(e.targetId);
    indegree.set(e.targetId, (indegree.get(e.targetId) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of indegree.entries()) {
    if (deg === 0) queue.push(id);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLevel = level.get(current) ?? 0;
    for (const next of outgoing.get(current) ?? []) {
      level.set(next, Math.max(level.get(next) ?? 0, currentLevel + 1));
      indegree.set(next, (indegree.get(next) ?? 1) - 1);
      if ((indegree.get(next) ?? 0) === 0) queue.push(next);
    }
  }

  let maxLevel = 0;
  for (const v of level.values()) {
    if (v > maxLevel) maxLevel = v;
  }

  for (const [id, deg] of indegree.entries()) {
    if (deg > 0) {
      maxLevel += 1;
      level.set(id, maxLevel);
    }
  }

  const layers = new Map<number, GraphNodeDto[]>();
  for (const n of nodes) {
    const l = level.get(n.id) ?? 0;
    const existing = layers.get(l) ?? [];
    existing.push(n);
    layers.set(l, existing);
  }

  for (const [sourceId, targets] of outgoing.entries()) {
    const sourceLevel = level.get(sourceId) ?? 0;
    for (const targetId of targets) {
      const current = childrenMaxLevel.get(targetId) ?? 0;
      childrenMaxLevel.set(targetId, Math.max(current, sourceLevel));
    }
  }

  const sortedLayers = [...layers.entries()].sort(([a], [b]) => a - b);
  const horizontalGap = 290;
  const verticalGap = 190;
  const cardWidth = 160;
  const cardHeight = 140;
  const positioned: Node[] = [];

  for (const [layerIndex, layerNodes] of sortedLayers) {
    layerNodes.sort((a, b) => {
      const aScore = childrenMaxLevel.get(a.id) ?? 0;
      const bScore = childrenMaxLevel.get(b.id) ?? 0;
      if (aScore !== bScore) return aScore - bScore;
      return a.label.localeCompare(b.label);
    });

    const totalLayerHeight = (layerNodes.length - 1) * verticalGap;
    layerNodes.forEach((n, i) => {
      const y = i * verticalGap - totalLayerHeight / 2;
      positioned.push({
        id: n.id,
        type: "tfNode",
        position: { x: layerIndex * horizontalGap, y },
        data: {
          label: n.label,
          kind: n.kind,
          thumbnailKey: n.thumbnailKey,
          node: n,
          isHighlighted: false,
        } as FlowNodeData,
        style: { width: cardWidth, height: cardHeight },
      });
    });
  }

  return positioned;
}

function NodeDetailsModal({
  node,
  allNodes,
  allEdges,
  onClose,
}: {
  node: GraphNodeDto;
  allNodes: GraphNodeDto[];
  allEdges: GraphEdgeDto[];
  onClose: () => void;
}) {
  const nodeById = useMemo(() => new Map(allNodes.map((n) => [n.id, n] as const)), [allNodes]);

  const incoming = useMemo(
    () => allEdges.filter((e) => e.targetId === node.id).map((e) => nodeById.get(e.sourceId)).filter((n): n is GraphNodeDto => Boolean(n)),
    [allEdges, node.id, nodeById]
  );

  const outgoing = useMemo(
    () => allEdges.filter((e) => e.sourceId === node.id).map((e) => nodeById.get(e.targetId)).filter((n): n is GraphNodeDto => Boolean(n)),
    [allEdges, node.id, nodeById]
  );

  const explain = explainNode(node, incoming, outgoing);
  const metadataEntries = Object.entries(node.metadata ?? {});

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Node Details</p>
            <h3 className="text-lg font-semibold text-slate-900">{node.label}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:border-slate-400 hover:text-slate-900"
          >
            Close
          </button>
        </div>

        <div className="space-y-3 text-sm text-slate-700">
          <p><span className="font-semibold text-slate-900">What it is:</span> {explain.what}</p>
          <p><span className="font-semibold text-slate-900">What it is used for:</span> {explain.usedFor}</p>
          <p><span className="font-semibold text-slate-900">How it is used here:</span> {explain.how}</p>
          <p><span className="font-semibold text-slate-900">Kind:</span> {node.kind}</p>
          <p><span className="font-semibold text-slate-900">ID:</span> <span className="font-mono text-xs">{node.id}</span></p>
          {node.resourceType && <p><span className="font-semibold text-slate-900">Resource Type:</span> {node.resourceType}</p>}
          {node.cloudProvider && <p><span className="font-semibold text-slate-900">Cloud:</span> {node.cloudProvider}</p>}
          {node.source && <p><span className="font-semibold text-slate-900">Source:</span> {node.source}</p>}
          {node.thumbnailKey && <p><span className="font-semibold text-slate-900">Thumbnail:</span> {node.thumbnailKey}</p>}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Depends On</p>
            {incoming.length === 0 ? <p className="text-xs text-slate-500">None</p> : <ul className="space-y-1 text-xs text-slate-700">{incoming.map((n) => <li key={n.id}>{n.label}</li>)}</ul>}
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Used By</p>
            {outgoing.length === 0 ? <p className="text-xs text-slate-500">None</p> : <ul className="space-y-1 text-xs text-slate-700">{outgoing.map((n) => <li key={n.id}>{n.label}</li>)}</ul>}
          </div>
        </div>

        {metadataEntries.length > 0 && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Metadata</p>
            <pre className="overflow-x-auto text-xs text-slate-700">{JSON.stringify(node.metadata, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

function collectReachableFromEnv(envId: string, edges: GraphEdgeDto[]): Set<string> {
  const outgoing = new Map<string, string[]>();
  for (const e of edges) {
    const next = outgoing.get(e.sourceId) ?? [];
    next.push(e.targetId);
    outgoing.set(e.sourceId, next);
  }

  const visited = new Set<string>([envId]);
  const queue = [envId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of outgoing.get(current) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  return visited;
}

function FlowView({ nodes, edges }: GraphCanvasProps) {
  const envNodes = useMemo(() => nodes.filter((n) => n.kind === "env"), [nodes]);
  const [selectedEnvId, setSelectedEnvId] = useState<string>("all");
  const activeEnvId =
    selectedEnvId === "all" || envNodes.some((n) => n.id === selectedEnvId)
      ? selectedEnvId
      : "all";

  const filtered = useMemo(() => {
    if (activeEnvId === "all") return { nodes, edges };

    const reachable = collectReachableFromEnv(activeEnvId, edges);
    const scopedNodes = nodes.filter((n) => reachable.has(n.id));
    const scopedIds = new Set(scopedNodes.map((n) => n.id));
    const scopedEdges = edges.filter((e) => scopedIds.has(e.sourceId) && scopedIds.has(e.targetId));

    return { nodes: scopedNodes, edges: scopedEdges };
  }, [nodes, edges, activeEnvId]);

  const signature = useMemo(() => {
    const nodeSig = filtered.nodes.map((n) => n.id).sort().join("|");
    const edgeSig = filtered.edges
      .map((e) => `${e.sourceId}>${e.targetId}`)
      .sort()
      .join("|");
    return `${nodeSig}::${edgeSig}`;
  }, [filtered]);

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<Node>([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNodeDto | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const { fitView } = useReactFlow();
  const prevSignature = useRef<string>("");

  useEffect(() => {
    if (prevSignature.current === signature) return;
    prevSignature.current = signature;

    setFlowNodes(layoutNodes(filtered.nodes, filtered.edges));
    setFlowEdges(toFlowEdges(filtered.edges));

    const rafId = requestAnimationFrame(() => {
      void fitView({
        duration: 350,
        padding: 0.2,
        includeHiddenNodes: true,
        minZoom: 0.2,
        maxZoom: 1.2,
      });
    });

    return () => cancelAnimationFrame(rafId);
  }, [signature, filtered.nodes, filtered.edges, fitView, setFlowEdges, setFlowNodes]);

  const highlightedNodeIds = useMemo(() => {
    if (!selectedEdgeId) return new Set<string>();
    const edge = flowEdges.find((e) => e.id === selectedEdgeId);
    if (!edge) return new Set<string>();
    return new Set<string>([edge.source, edge.target]);
  }, [flowEdges, selectedEdgeId]);

  const styledNodes = useMemo(
    () =>
      flowNodes.map((node) => {
        const isHighlighted = highlightedNodeIds.has(node.id);
        const faded = selectedEdgeId ? !isHighlighted : false;
        const data = (node.data ?? {}) as FlowNodeData;

        return {
          ...node,
          data: {
            ...data,
            isHighlighted,
          } as FlowNodeData,
          style: {
            ...node.style,
            opacity: faded ? 0.35 : 1,
          },
        };
      }),
    [flowNodes, highlightedNodeIds, selectedEdgeId]
  );

  const styledEdges = useMemo(
    () =>
      flowEdges.map((e) => {
        const isSelected = selectedEdgeId === e.id;
        const faded = selectedEdgeId ? !isSelected : false;
        return {
          ...e,
          animated: isSelected,
          style: {
            stroke: isSelected ? "#0f172a" : "#64748b",
            strokeWidth: isSelected ? 2.6 : 1.5,
            opacity: faded ? 0.2 : 1,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isSelected ? "#0f172a" : "#64748b",
            width: isSelected ? 18 : 16,
            height: isSelected ? 18 : 16,
          },
        };
      }),
    [flowEdges, selectedEdgeId]
  );

  const prettify = () => {
    setFlowNodes(layoutNodes(filtered.nodes, filtered.edges));
    setFlowEdges(toFlowEdges(filtered.edges));
    setSelectedEdgeId(null);

    requestAnimationFrame(() => {
      void fitView({
        duration: 300,
        padding: 0.2,
        includeHiddenNodes: true,
        minZoom: 0.2,
        maxZoom: 1.2,
      });
    });
  };

  const onNodeClick = (_event: React.MouseEvent, node: Node) => {
    const data = node.data as FlowNodeData | undefined;
    if (data?.node) setSelectedNode(data.node);
  };

  const onEdgeClick = (_event: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id);
  };

  const onPaneClick = () => {
    setSelectedEdgeId(null);
  };

  return (
    <div className="relative h-full w-full">
      <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
        <label className="rounded-md border border-slate-300 bg-white/95 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 shadow-sm backdrop-blur">
          Environment
          <select
            className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700"
            value={activeEnvId}
            onChange={(e) => {
              setSelectedEnvId(e.target.value);
              setSelectedNode(null);
              setSelectedEdgeId(null);
            }}
          >
            <option value="all">All</option>
            {envNodes.map((envNode) => (
              <option key={envNode.id} value={envNode.id}>
                {envNode.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={prettify}
          className="rounded-md border border-slate-300 bg-white/95 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 shadow-sm backdrop-blur hover:border-cyan-400 hover:text-slate-900"
        >
          Prettify
        </button>
        <button
          type="button"
          onClick={() => {
            void fitView({ duration: 250, padding: 0.2, minZoom: 0.2, maxZoom: 1.2 });
          }}
          className="rounded-md border border-slate-300 bg-white/95 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 shadow-sm backdrop-blur hover:border-cyan-400 hover:text-slate-900"
        >
          Fit View
        </button>
      </div>

      <ReactFlow
        nodes={styledNodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        connectionLineType={ConnectionLineType.SmoothStep}
        nodeTypes={nodeTypes}
        fitView
        defaultEdgeOptions={{
          type: "smoothstep",
          style: { stroke: "#64748b", strokeWidth: 1.5 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "#64748b",
          },
        }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        className="bg-gradient-to-br from-slate-50 via-cyan-50/30 to-blue-50/70"
      >
        <Background gap={20} size={1} color="#cbd5e1" />
        <Controls />
        <MiniMap nodeColor="#475569" maskColor="rgba(15,23,42,0.08)" />
      </ReactFlow>

      {selectedNode && <NodeDetailsModal node={selectedNode} allNodes={filtered.nodes} allEdges={filtered.edges} onClose={() => setSelectedNode(null)} />}
    </div>
  );
}

export function GraphCanvas({ nodes, edges }: GraphCanvasProps) {
  if (nodes.length === 0) {
    return (
      <div className="flex min-h-[500px] w-full items-center justify-center rounded-xl border border-dashed border-slate-300/80 bg-slate-100/70 text-slate-500">
        <p>No nodes to display yet. Upload a Terraform ZIP to render the graph.</p>
      </div>
    );
  }

  return (
    <div className="h-[70vh] min-h-[540px] w-full rounded-2xl border border-slate-200/90 bg-white/85 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.5)] backdrop-blur">
      <ReactFlowProvider>
        <FlowView nodes={nodes} edges={edges} />
      </ReactFlowProvider>
    </div>
  );
}

export function recenterCanvas(instance: ReactFlowInstance | null) {
  if (!instance) return;
  instance.fitView({ duration: 250, padding: 0.2, minZoom: 0.2, maxZoom: 1.2 });
}
