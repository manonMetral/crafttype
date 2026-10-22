import { getJson, type RequestOptions } from './http.js';

/** Reply of `GET /api/health` (see `src/server/app.ts`). */
export interface HealthResponse {
  readonly status: string;
}

export const fetchHealth = (
  options?: RequestOptions,
): Promise<HealthResponse> => getJson<HealthResponse>('/health', options);
