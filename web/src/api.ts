import type { ApplyResult, BasketPreview, Catalog, PreviewRequest, ProjectState } from './types';

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
  /** What the basket would do. Nothing is written, whatever the answer. */
  preview(request: PreviewRequest): Promise<BasketPreview>;
  /**
   * Writes the basket to the project. A basket that cannot apply is an answer (`refused`, nothing written), not an
   * error; an error means the request failed, and some modules may have been written before it.
   */
  apply(request: PreviewRequest): Promise<ApplyResult>;
}

/** Calls the API of the server that served the page, with the token. */
export const createApi = (token: string, fetchJson: typeof fetch = (...args) => fetch(...args)): Api => {
  const call = async <T>(path: string, init: { method: string; body: string } | undefined = undefined): Promise<T> => {
    const response = await fetchJson(path, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...init,
    });
    const body: unknown = await response.json();
    if (!response.ok) {
      const { error, hint } = body as { error?: string; hint?: string };
      throw new ApiError(error ?? `the server answered ${response.status}`, response.status, hint);
    }
    return body as T;
  };

  return {
    catalog: () => call<Catalog>('/api/modules'),
    preview: (request) => call<BasketPreview>('/api/basket/preview', { method: 'POST', body: JSON.stringify(request) }),
    apply: (request) => call<ApplyResult>('/api/basket/apply', { method: 'POST', body: JSON.stringify(request) }),
    project: (folder) =>
      call<ProjectState>(folder === undefined ? '/api/project' : `/api/project?folder=${encodeURIComponent(folder)}`),
  };
};
