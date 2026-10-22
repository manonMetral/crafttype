/** Prefix of every request: the Vite dev proxy (vite.config.ts) forwards it to the server. */
export const API_BASE = '/api';

/**
 * A request that did not give a usable answer: the server replied with an error status, the reply is not JSON, or no
 * reply came back at all (then `status` is `undefined` and `cause` is the original error).
 */
export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status of the reply, `undefined` when there was none (network failure). */
    readonly status: number | undefined,
    /** Parsed JSON body of the reply (a problem document for instance), or its raw text when it is not JSON. */
    readonly body?: unknown,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  /** Cancels the request: `fetch` then rejects with an `AbortError`, which is not turned into an `ApiError`. */
  readonly signal?: AbortSignal;
}

type Body =
  | { readonly json: true; readonly value: unknown }
  | { readonly json: false; readonly text: string };

const parse = (text: string): Body => {
  try {
    return { json: true, value: JSON.parse(text) };
  } catch {
    return { json: false, text };
  }
};

const request = async <T>(path: string, init: RequestInit): Promise<T> => {
  let response: Response;
  let text: string;
  try {
    response = await fetch(`${API_BASE}${path}`, init);
    text = await response.text();
  } catch (error) {
    if (init.signal?.aborted) {
      throw error;
    }
    throw new ApiError(
      'The server cannot be reached',
      undefined,
      undefined,
      error,
    );
  }

  const body = text === '' ? undefined : parse(text);
  const content =
    body === undefined ? undefined : body.json ? body.value : body.text;
  if (!response.ok) {
    throw new ApiError(
      `Request failed with status ${response.status}`,
      response.status,
      content,
    );
  }
  if (body !== undefined && !body.json) {
    throw new ApiError('The reply is not JSON', response.status, content);
  }
  // An empty reply (204) gives `undefined`: use `void` as the type of such an endpoint.
  return content as T;
};

/** GET `path` (for instance `/health`, relative to `API_BASE`) and parses the JSON reply. */
export const getJson = <T>(
  path: string,
  { signal }: RequestOptions = {},
): Promise<T> =>
  request<T>(path, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

/** POST `body` as JSON to `path` and parses the JSON reply. */
export const postJson = <T, B = unknown>(
  path: string,
  body: B,
  { signal }: RequestOptions = {},
): Promise<T> =>
  request<T>(path, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
