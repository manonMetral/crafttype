import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, getJson, postJson } from './http.js';

const reply = (body: string | null, status = 200) =>
  Promise.resolve(new Response(body, { status }));

const stubFetch = (implementation: typeof fetch) => {
  const stub = vi.fn<typeof fetch>(implementation);
  vi.stubGlobal('fetch', stub);
  return stub;
};

const failure = async (call: Promise<unknown>): Promise<ApiError> => {
  const error = await call.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getJson', () => {
  it('asks for JSON under /api and parses the reply', async () => {
    const fetchStub = stubFetch(() => reply('{"name":"shop"}'));

    await expect(getJson<{ name: string }>('/things/1')).resolves.toEqual({
      name: 'shop',
    });

    expect(fetchStub).toHaveBeenCalledWith(
      '/api/things/1',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchStub.mock.calls[0]?.[1]?.headers).toEqual({
      Accept: 'application/json',
    });
  });

  it('gives undefined for an empty reply, such as a 204', async () => {
    stubFetch(() => reply(null, 204));

    await expect(getJson<void>('/things/1')).resolves.toBeUndefined();
  });

  it('keeps the status and the JSON problem of an error reply', async () => {
    stubFetch(() => reply('{"title":"Not found"}', 404));

    const error = await failure(getJson('/things/2'));

    expect(error.status).toBe(404);
    expect(error.body).toEqual({ title: 'Not found' });
    expect(error.message).toBe('Request failed with status 404');
  });

  it('has no body for an error reply without one', async () => {
    stubFetch(() => reply(null, 500));

    const error = await failure(getJson('/things'));

    expect(error.status).toBe(500);
    expect(error.body).toBeUndefined();
  });

  it('keeps the raw text of an error reply that is not JSON', async () => {
    stubFetch(() => reply('<html>Bad gateway</html>', 502));

    const error = await failure(getJson('/things'));

    expect(error.status).toBe(502);
    expect(error.body).toBe('<html>Bad gateway</html>');
  });

  it('refuses a successful reply that is not JSON', async () => {
    stubFetch(() => reply('hello'));

    const error = await failure(getJson('/things'));

    expect(error.status).toBe(200);
    expect(error.body).toBe('hello');
    expect(error.message).toBe('The reply is not JSON');
  });

  it('turns a network failure into an ApiError without status, keeping the cause', async () => {
    const cause = new TypeError('Failed to fetch');
    stubFetch(() => Promise.reject(cause));

    const error = await failure(getJson('/things'));

    expect(error.status).toBeUndefined();
    expect(error.cause).toBe(cause);
  });

  it('turns a failure while the body is read into an ApiError too', async () => {
    const broken = new Response('{}');
    vi.spyOn(broken, 'text').mockRejectedValue(new TypeError('terminated'));
    stubFetch(() => Promise.resolve(broken));

    const error = await failure(getJson('/things'));

    expect(error.status).toBeUndefined();
  });
});

describe('cancellation', () => {
  const hangingUntilAborted: typeof fetch = (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () =>
        reject(init.signal?.reason),
      );
    });

  it('passes the signal to fetch', async () => {
    const fetchStub = stubFetch(() => reply('{}'));
    const { signal } = new AbortController();

    await getJson('/things', { signal });

    expect(fetchStub.mock.calls[0]?.[1]?.signal).toBe(signal);
  });

  it('rejects with the AbortError, not with an ApiError', async () => {
    stubFetch(hangingUntilAborted);
    const controller = new AbortController();

    const pending = getJson('/things', { signal: controller.signal });
    controller.abort();

    const error: unknown = await pending.then(
      () => undefined,
      (reason: unknown) => reason,
    );
    expect(error).not.toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ name: 'AbortError' });
  });
});

describe('postJson', () => {
  it('sends the body as JSON and parses the reply', async () => {
    const fetchStub = stubFetch(() => reply('{"id":7}', 201));

    await expect(
      postJson<{ id: number }, { name: string }>('/things', { name: 'shop' }),
    ).resolves.toEqual({ id: 7 });

    const init = fetchStub.mock.calls[0]?.[1];
    expect(fetchStub.mock.calls[0]?.[0]).toBe('/api/things');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"name":"shop"}');
    expect(init?.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
  });

  it('reports a rejected body like any other error reply', async () => {
    stubFetch(() => reply('{"title":"Invalid name"}', 422));

    const error = await failure(postJson('/things', { name: '' }));

    expect(error.status).toBe(422);
    expect(error.body).toEqual({ title: 'Invalid name' });
  });
});
