import { clearToken, getToken } from '../utils/tokenStore';

export const API_BASE = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function headers(extra = {}) {
  const token = getToken();
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

async function parse(res) {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) clearToken(); // expired or invalid session
    throw new ApiError(res.status, (data && data.message) || 'Request failed', data);
  }
  return data;
}

/**
 * JSON API helper. `body` is sent as JSON, `formData` as multipart (the browser sets the boundary).
 * Resolves with the parsed JSON and throws ApiError(status, message, data) otherwise.
 */
export async function api(path, { method = 'GET', body, formData } = {}) {
  const init = { method, headers: headers() };
  if (formData) init.body = formData;
  else if (body !== undefined) {
    init.headers = headers({ 'Content-Type': 'application/json' });
    init.body = JSON.stringify(body);
  }
  return parse(await fetch(`${API_BASE}${path}`, init));
}

/** Downloads a protected file (the JWT is in a header, so a plain link cannot be used). */
export async function downloadFile(path, filename) {
  const res = await fetch(`${API_BASE}${path}`, { headers: headers() });
  if (!res.ok) await parse(res);
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Builds a query string, skipping empty values. */
export function qs(params) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== undefined && v !== null && v !== '' && sp.set(k, v));
  const s = sp.toString();
  return s ? `?${s}` : '';
}
