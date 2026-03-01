/**
 * DAG (Directed Acyclic Graph) for Terraform modules/resources.
 * Nodes: env (root), modules, resources, providers, data sources.
 * Edges are directed from prerequisite -> dependent.
 */

import type { ParsedTerraform, ParsedModule } from "./tf-parser";
import { getThumbnailKey, getCloudProvider } from "./thumbnails";

export type NodeKind = "env" | "module" | "resource" | "provider" | "data";

export interface DagNode {
  id: string;
  externalId: string;
  label: string;
  kind: NodeKind;
  resourceType?: string;
  thumbnailKey: string;
  cloudProvider?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface DagEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
}

export interface TerraformDag {
  nodes: DagNode[];
  edges: DagEdge[];
}

function nodeId(kind: string, ...parts: string[]): string {
  return [kind, ...parts].filter(Boolean).join(".");
}

function sanitizePart(part: string): string {
  return part.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalizeEnvName(value: string): string {
  const raw = value.trim().toLowerCase();
  if (raw === "production") return "prod";
  if (raw === "stage") return "staging";
  return raw;
}

function inferEnvFromPath(path?: string): string | undefined {
  if (!path) return undefined;
  const m = path.match(/(?:^|\/)environments\/(.+?)(?:\/|$)/i);
  if (!m?.[1]) return undefined;
  return normalizeEnvName(m[1]);
}

function moduleEnv(mod: ParsedModule): string | undefined {
  if (mod.env) return normalizeEnvName(mod.env);
  return inferEnvFromPath(mod.path);
}

export function buildDagFromParsed(parsed: ParsedTerraform, envName: string): TerraformDag {
  const nodes: DagNode[] = [];
  const edges: DagEdge[] = [];
  const nodeIds = new Set<string>();

  const discoveredEnvs = [...new Set(parsed.modules.map(moduleEnv).filter((e): e is string => Boolean(e)))];
  const envs = discoveredEnvs.length > 0 ? discoveredEnvs : [normalizeEnvName(envName)];

  for (const env of envs) {
    const envNodeId = nodeId("env", env);
    if (nodeIds.has(envNodeId)) continue;
    nodeIds.add(envNodeId);
    nodes.push({
      id: envNodeId,
      externalId: envNodeId,
      label: env,
      kind: "env",
      thumbnailKey: "env",
      metadata: { env },
    });
  }

  const moduleNodeIdsByEnvAndName = new Map<string, string>();
  const firstModuleNodeByName = new Map<string, string>();

  const refToNodeId = (ref: string, env: string): string | null => {
    if (ref.startsWith("module.")) {
      const name = ref.split(".")[1];
      if (!name) return null;
      return moduleNodeIdsByEnvAndName.get(`${env}::${name}`) ?? firstModuleNodeByName.get(name) ?? null;
    }

    if (ref.startsWith("data.")) {
      const [, type, name] = ref.split(".");
      return type && name ? nodeId("data", env, type, name) : null;
    }

    const parts = ref.split(".");
    if (parts.length >= 2) {
      const [type, name] = parts;
      return type && name ? nodeId("resource", env, type, name) : null;
    }

    return null;
  };

  const modulesWithEnv = parsed.modules.map((mod) => ({
    mod,
    env: moduleEnv(mod) ?? envs[0],
  }));

  for (const { mod, env } of modulesWithEnv) {
    const envNodeId = nodeId("env", env);
    const modulePathKey = sanitizePart(mod.path ?? "root");
    const moduleNodeId = nodeId("module", env, mod.name, modulePathKey);

    if (!nodeIds.has(moduleNodeId)) {
      nodeIds.add(moduleNodeId);
      nodes.push({
        id: moduleNodeId,
        externalId: moduleNodeId,
        label: mod.name,
        kind: "module",
        source: mod.source,
        thumbnailKey: getThumbnailKey("module", undefined, undefined),
        metadata: {
          env,
          path: mod.path,
          ...(mod.version ? { version: mod.version } : {}),
        },
      });
    }

    moduleNodeIdsByEnvAndName.set(`${env}::${mod.name}`, moduleNodeId);
    if (!firstModuleNodeByName.has(mod.name)) firstModuleNodeByName.set(mod.name, moduleNodeId);

    edges.push({
      id: `e-${envNodeId}-${moduleNodeId}`,
      sourceId: envNodeId,
      targetId: moduleNodeId,
      label: "contains",
    });
  }

  const scopedEnvs = envs;

  for (const env of scopedEnvs) {
    const envNodeId = nodeId("env", env);

    for (const res of parsed.resources) {
      const resourceNodeId = nodeId("resource", env, res.type, res.name);
      if (!nodeIds.has(resourceNodeId)) {
        nodeIds.add(resourceNodeId);
        nodes.push({
          id: resourceNodeId,
          externalId: resourceNodeId,
          label: res.name,
          kind: "resource",
          resourceType: res.type,
          thumbnailKey: getThumbnailKey("resource", res.type, undefined),
          cloudProvider: getCloudProvider(res.type),
          metadata: {
            env,
            path: res.path,
          },
        });
      }

      edges.push({
        id: `e-${envNodeId}-${resourceNodeId}`,
        sourceId: envNodeId,
        targetId: resourceNodeId,
      });

      for (const ref of res.refs) {
        const depId = refToNodeId(ref, env);
        if (depId && depId !== resourceNodeId) {
          edges.push({
            id: `e-${depId}-${resourceNodeId}`,
            sourceId: depId,
            targetId: resourceNodeId,
          });
        }
      }
    }

    for (const data of parsed.dataSources) {
      const dataNodeId = nodeId("data", env, data.type, data.name);
      if (!nodeIds.has(dataNodeId)) {
        nodeIds.add(dataNodeId);
        nodes.push({
          id: dataNodeId,
          externalId: dataNodeId,
          label: data.name,
          kind: "data",
          resourceType: data.type,
          thumbnailKey: getThumbnailKey("data", data.type, undefined),
          cloudProvider: getCloudProvider(data.type),
          metadata: {
            env,
            path: data.path,
          },
        });
      }

      edges.push({
        id: `e-${envNodeId}-${dataNodeId}`,
        sourceId: envNodeId,
        targetId: dataNodeId,
      });

      for (const ref of data.refs) {
        const depId = refToNodeId(ref, env);
        if (depId && depId !== dataNodeId) {
          edges.push({
            id: `e-${depId}-${dataNodeId}`,
            sourceId: depId,
            targetId: dataNodeId,
          });
        }
      }
    }

    for (const prov of parsed.providers) {
      const providerNodeId = nodeId("provider", env, prov.name);
      if (!nodeIds.has(providerNodeId)) {
        nodeIds.add(providerNodeId);
        const cloudProvider =
          prov.name.startsWith("aws")
            ? ("aws" as const)
            : prov.name.startsWith("google")
              ? ("gcp" as const)
              : prov.name.startsWith("azurerm") || prov.name.startsWith("azure")
                ? ("azure" as const)
                : ("other" as const);

        nodes.push({
          id: providerNodeId,
          externalId: providerNodeId,
          label: prov.name,
          kind: "provider",
          thumbnailKey: getThumbnailKey("provider", undefined, prov.name),
          cloudProvider,
          metadata: {
            env,
            path: prov.path,
          },
        });
      }

      edges.push({
        id: `e-${envNodeId}-${providerNodeId}`,
        sourceId: envNodeId,
        targetId: providerNodeId,
      });
    }
  }

  for (const { mod, env } of modulesWithEnv) {
    const moduleNodeId = moduleNodeIdsByEnvAndName.get(`${env}::${mod.name}`);
    if (!moduleNodeId) continue;

    for (const ref of mod.refs) {
      const depId = refToNodeId(ref, env);
      if (depId && depId !== moduleNodeId) {
        edges.push({
          id: `e-${depId}-${moduleNodeId}`,
          sourceId: depId,
          targetId: moduleNodeId,
        });
      }
    }
  }

  const edgeSet = new Set<string>();
  const uniqueEdges = edges.filter((e) => {
    const key = `${e.sourceId}->${e.targetId}`;
    if (edgeSet.has(key)) return false;
    edgeSet.add(key);
    return true;
  });

  return {
    nodes,
    edges: uniqueEdges,
  };
}
