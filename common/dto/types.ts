/**
 * Shared types for Terraform module/resource representation
 */

export type NodeKind = 'env' | 'module' | 'resource' | 'provider' | 'data';

export type CloudProvider = 'aws' | 'gcp' | 'azure' | 'other';

export interface GraphNodeDto {
  id: string;
  label: string;
  kind: NodeKind;
  /** e.g. aws_db_instance, google_sql_database_instance */
  resourceType?: string;
  /** For thumbnail selection: aws-rds, gcp-cloud-sql, etc. */
  thumbnailKey?: string;
  cloudProvider?: CloudProvider;
  /** Path or source of the module */
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdgeDto {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
}

export interface GraphDto {
  id: string;
  name: string;
  nodes: GraphNodeDto[];
  edges: GraphEdgeDto[];
  createdAt: string;
}
