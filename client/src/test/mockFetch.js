import { vi } from 'vitest';

/**
 * Replaces global fetch with a router over JSON responses.
 *   mockFetch([{ method: 'POST', match: /\/auth\/login/, status: 200, body: {...} }])
 * `body` may be a function (url, options) => body. Unmatched requests answer 404.
 * Returns the vi.fn so tests can assert on calls.
 */
export function mockFetch(routes = []) {
  const fn = vi.fn(async (url, options = {}) => {
    const method = (options.method || 'GET').toUpperCase();
    const route = routes.find((r) => (r.method || 'GET') === method && r.match.test(String(url)));
    if (!route) return respond(404, { message: 'Not found' });
    const body = typeof route.body === 'function' ? route.body(String(url), options) : route.body;
    return respond(route.status || 200, body, route.blob);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

function respond(status, body, blob) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
    blob: async () => blob || new Blob(['file-content']),
  };
}

/** Parses the JSON body a fetch call was made with. */
export const sentBody = (call) => JSON.parse(call[1].body);
