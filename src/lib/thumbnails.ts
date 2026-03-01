/**
 * Map Terraform resource types and providers to thumbnail keys for the UI.
 * Keys are used to pick SVG/icon assets (e.g. AWS RDS, GCP Cloud SQL).
 */

export type ThumbnailKey =
  | "env"
  | "module"
  | "provider"
  | "aws-rds"
  | "aws-ec2"
  | "aws-s3"
  | "aws-lambda"
  | "aws-vpc"
  | "gcp-cloud-sql"
  | "gcp-gke"
  | "gcp-compute"
  | "gcp-storage"
  | "azure-sql"
  | "azure-vm"
  | "terraform"
  | "default";

const RESOURCE_TO_THUMBNAIL: Record<string, ThumbnailKey> = {
  // AWS
  aws_db_instance: "aws-rds",
  aws_rds_cluster: "aws-rds",
  aws_instance: "aws-ec2",
  aws_s3_bucket: "aws-s3",
  aws_lambda_function: "aws-lambda",
  aws_vpc: "aws-vpc",
  aws_subnet: "aws-vpc",
  // GCP
  google_sql_database_instance: "gcp-cloud-sql",
  google_container_cluster: "gcp-gke",
  google_compute_instance: "gcp-compute",
  google_storage_bucket: "gcp-storage",
  // Azure
  azurerm_mssql_server: "azure-sql",
  azurerm_virtual_machine: "azure-vm",
};

const PROVIDER_TO_THUMBNAIL: Record<string, ThumbnailKey> = {
  aws: "aws-ec2",
  google: "gcp-compute",
  "google-beta": "gcp-compute",
  azurerm: "azure-vm",
};

export function getThumbnailKey(
  kind: string,
  resourceType?: string | null,
  _provider?: string | null
): ThumbnailKey {
  if (kind === "env") return "env";
  if (kind === "module") return "module";
  if (kind === "provider") return "provider";
  if (kind === "data") return "terraform";
  if (resourceType && RESOURCE_TO_THUMBNAIL[resourceType])
    return RESOURCE_TO_THUMBNAIL[resourceType];
  if (_provider && PROVIDER_TO_THUMBNAIL[_provider])
    return PROVIDER_TO_THUMBNAIL[_provider];
  return "default";
}

export function getCloudProvider(resourceType?: string | null): "aws" | "gcp" | "azure" | "other" {
  if (!resourceType) return "other";
  if (resourceType.startsWith("aws_")) return "aws";
  if (resourceType.startsWith("google_")) return "gcp";
  if (resourceType.startsWith("azurerm_")) return "azure";
  return "other";
}
