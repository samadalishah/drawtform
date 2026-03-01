/**
 * Upload API contract
 */

export interface UploadTerraformRequest {
  /** Optional name for this graph (e.g. "prod", "staging") */
  name?: string;
}

export interface UploadTerraformResponse {
  graphId: string;
  message: string;
}
