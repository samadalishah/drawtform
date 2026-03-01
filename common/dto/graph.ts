/**
 * Graph API contracts
 */

import type { GraphDto } from './types';

export interface GetGraphResponse {
  graph: GraphDto | null;
}

export interface ListGraphsResponse {
  graphs: Pick<GraphDto, 'id' | 'name' | 'createdAt'>[];
}
