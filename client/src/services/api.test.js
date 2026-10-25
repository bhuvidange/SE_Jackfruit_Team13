import { ApiError, api, qs } from './api';
import { mockFetch, sentBody } from '../test/mockFetch';
import { getToken, setToken } from '../utils/tokenStore';

describe('api helper', () => {
  test('sends the bearer token and JSON body', async () => {
    setToken('abc');
    const fetchMock = mockFetch([{ method: 'POST', match: /\/things$/, body: { ok: 1 } }]);
    const data = await api('/things', { method: 'POST', body: { a: 1 } });
    expect(data).toEqual({ ok: 1 });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/things');
    expect(options.headers).toMatchObject({ Authorization: 'Bearer abc', 'Content-Type': 'application/json' });
    expect(sentBody(fetchMock.mock.calls[0])).toEqual({ a: 1 });
  });

  test('multipart bodies are passed through without a content type', async () => {
    setToken('abc');
    const fetchMock = mockFetch([{ method: 'POST', match: /\/up$/, body: {} }]);
    const formData = new FormData();
    formData.append('x', '1');
    await api('/up', { method: 'POST', formData });
    expect(fetchMock.mock.calls[0][1].body).toBe(formData);
    expect(fetchMock.mock.calls[0][1].headers['Content-Type']).toBeUndefined();
  });

  test('errors become ApiError with status, message and data', async () => {
    mockFetch([{ match: /\/bad$/, status: 403, body: { message: 'Nope', extra: 1 } }]);
    const err = await api('/bad').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 403, message: 'Nope', data: { extra: 1 } });
  });

  test('a 401 clears the stored session (expired or tampered token)', async () => {
    setToken('stale');
    mockFetch([{ match: /\/me$/, status: 401, body: { message: 'Token expired' } }]);
    await expect(api('/me')).rejects.toThrow('Token expired');
    expect(getToken()).toBeNull();
  });

  test('qs skips empty values and encodes the rest', () => {
    expect(qs({ a: 'x y', b: '', c: undefined, d: null })).toBe('?a=x+y');
    expect(qs({})).toBe('');
  });
});
