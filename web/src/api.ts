import type { Catalog, ProjectState } from './types';

/** The server refused or failed: what it said, and how to fix it if it knows. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly hint?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface Api {
  catalog(): Promise<Catalog>;
  project(folder?: string): Promise<ProjectState>;
}

/** Calls the API of the server that served the page, with the token. */
export const createApi = (token: string, fetchJson: typeof fetch = (...args) => fetch(...args)): Api => {
  const call = async <T>(path: string): Promise<T> => {
    const response = await fetchJson(path, { headers: { Authorization: `Bearer ${token}` } });
    const body: unknown = await response.json();
    if (!response.ok) {
      const { error, hint } = body as { error?: string; hint?: string };
      throw new ApiError(error ?? `the server answered ${response.status}`, response.status, hint);
    }
    return body as T;
  };

  return {
    catalog: () => call<Catalog>('/api/modules'),
    project: (folder) =>
      call<ProjectState>(folder === undefined ? '/api/project' : `/api/project?folder=${encodeURIComponent(folder)}`),
  };
};
