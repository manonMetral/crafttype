import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createApi } from './api';

describe('API client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const answering = (status: number, body: unknown) => {
    const calls: { path: string; headers: HeadersInit | undefined; method?: string | undefined; body?: unknown }[] = [];
    const fetchJson = (async (path: string, init?: RequestInit) => {
      calls.push({
        path,
        headers: init?.headers,
        ...(init?.method === undefined ? {} : { method: init.method, body: init.body }),
      });
      return new Response(JSON.stringify(body), { status });
    }) as typeof fetch;
    return { calls, fetchJson };
  };

  it('asks for the catalog with the token', async () => {
    const { calls, fetchJson } = answering(200, { modules: [] });

    const catalog = await createApi('secret', fetchJson).catalog();

    expect(catalog).toEqual({ modules: [] });
    expect(calls).toEqual([{ path: '/api/modules', headers: { Authorization: 'Bearer secret' } }]);
  });

  it('uses the fetch of the page unless told otherwise', async () => {
    const page = vi.fn(async () => new Response(JSON.stringify({ modules: [] })));
    vi.stubGlobal('fetch', page);

    await createApi('secret').catalog();

    expect(page).toHaveBeenCalledWith('/api/modules', { headers: { Authorization: 'Bearer secret' } });
  });

  it('asks for the project of the folder the server was launched in', async () => {
    const { calls, fetchJson } = answering(200, { projectFolder: '/p', applied: [], presets: {} });

    await createApi('secret', fetchJson).project();

    expect(calls[0]?.path).toBe('/api/project');
  });

  it('asks for the project of another folder, whatever characters its path has', async () => {
    const { calls, fetchJson } = answering(200, { projectFolder: '/p', applied: [], presets: {} });

    await createApi('secret', fetchJson).project('/my projects/a&b?c#d');

    expect(calls[0]?.path).toBe('/api/project?folder=%2Fmy%20projects%2Fa%26b%3Fc%23d');
  });

  it('asks for the preview of a basket by posting it as JSON, with the token', async () => {
    const answer = { projectFolder: '/p', steps: [], canApply: true };
    const { calls, fetchJson } = answering(200, answer);
    const request = {
      modules: ['init', 'typescript'],
      properties: { projectName: 'shop' },
      onConflict: 'skip' as const,
    };

    const preview = await createApi('secret', fetchJson).preview(request);

    expect(preview).toEqual(answer);
    expect(calls).toEqual([
      {
        path: '/api/basket/preview',
        headers: { Authorization: 'Bearer secret', 'Content-Type': 'application/json' },
        method: 'POST',
        body: JSON.stringify(request),
      },
    ]);
  });

  it('asks to apply a basket by posting it as JSON, with the token, and gives the answer', async () => {
    const answer = { outcome: 'applied', projectFolder: '/p', steps: [] };
    const { calls, fetchJson } = answering(200, answer);
    const request = { modules: ['init'], properties: { projectName: 'shop' }, onConflict: 'overwrite' as const };

    const result = await createApi('secret', fetchJson).apply(request);

    expect(result).toEqual(answer);
    expect(calls).toEqual([
      {
        path: '/api/basket/apply',
        headers: { Authorization: 'Bearer secret', 'Content-Type': 'application/json' },
        method: 'POST',
        body: JSON.stringify(request),
      },
    ]);
  });

  it('gives a basket that could not apply as an answer, not as an error: nothing was written', async () => {
    const answer = { outcome: 'refused', preview: { projectFolder: '/p', steps: [], canApply: false } };
    const { fetchJson } = answering(200, answer);

    expect(await createApi('secret', fetchJson).apply({ modules: ['init'] })).toEqual(answer);
  });

  it('turns what the server refuses in an application into an error, with its reason', async () => {
    const { fetchJson } = answering(422, { error: 'cannot access /p: permission denied (EACCES)' });

    const failure = await createApi('secret', fetchJson)
      .apply({ modules: ['init'] })
      .catch((error: unknown) => error);

    expect(failure).toMatchObject({
      name: 'ApiError',
      message: 'cannot access /p: permission denied (EACCES)',
      status: 422,
    });
  });

  it('turns what the server refuses in a preview into an error, with its reason', async () => {
    const { fetchJson } = answering(422, { error: 'Unknown module: nope' });

    const failure = await createApi('secret', fetchJson)
      .preview({ modules: ['nope'] })
      .catch((error: unknown) => error);

    expect(failure).toMatchObject({ name: 'ApiError', message: 'Unknown module: nope', status: 422 });
  });

  it('turns a refusal into an error with what the server said, and its hint', async () => {
    const { fetchJson } = answering(401, { error: 'missing or invalid token', hint: 'send the token' });

    const failure = await createApi('wrong', fetchJson)
      .catalog()
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({
      name: 'ApiError',
      message: 'missing or invalid token',
      status: 401,
      hint: 'send the token',
    });
  });

  it('has no hint when the server gave none', async () => {
    const { fetchJson } = answering(422, { error: 'Unknown module: nope' });

    const failure = (await createApi('t', fetchJson)
      .project()
      .catch((error: unknown) => error)) as ApiError;

    expect(failure.message).toBe('Unknown module: nope');
    expect(failure.hint).toBeUndefined();
  });

  it('still explains a failure whose answer says nothing', async () => {
    const { fetchJson } = answering(500, {});

    const failure = await createApi('t', fetchJson)
      .catalog()
      .catch((error: unknown) => error);

    expect(failure).toMatchObject({ message: 'the server answered 500', status: 500 });
  });
});
