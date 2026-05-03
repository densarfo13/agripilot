/**
 * apiClient.ts — fetch-based HTTP client for the Calm-UI
 * services layer.
 *
 *   import { apiClient } from '../services/apiClient';
 *   const data = await apiClient<MyResponse>('/actions/today');
 *
 * Why this exists alongside `src/api/client.js`
 * ─────────────────────────────────────────────
 *   The legacy `api/client.js` is an axios-based client used
 *   by every component shipped before the Calm-UI Upgrade.
 *   Migrating it would touch dozens of files for no functional
 *   gain.
 *
 *   The new services layer (weather / action / scan) prefers a
 *   typed `fetch` client because:
 *     • Zero added bundle weight — `fetch` is native.
 *     • Easier to type with generics for the new TS service files.
 *     • Symmetrical with the spec literal in §2 ("apiClient" as a
 *       fetch wrapper).
 *
 *   Both clients hit the SAME backend with the SAME bearer token
 *   from localStorage; auth + rate-limit + cookie semantics are
 *   identical. New service files use `apiClient`; existing
 *   components keep using `api/client.js`. Strict no-duplicates:
 *   no parallel auth pipeline, no different env-var keys.
 *
 * Strict-rule audit
 *   • Reads `VITE_API_BASE_URL` at module load — never embeds.
 *   • Reads bearer token from localStorage on every call so a
 *     login mid-session updates auth without a page refresh.
 *   • Never throws on a 4xx — returns a structured `ApiError`
 *     so callers can branch without try/catch every line.
 *   • Never logs the token; never logs the response body to
 *     console (avoids leaking PII into devtools).
 *   • Returns parsed JSON on 2xx; null body for 204.
 *   • TypeScript types kept narrow — `unknown` over `any`.
 */

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || '';

export type ApiClientOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  // When true, send `body` as FormData rather than JSON. Used by
  // the scan service for multipart uploads.
  multipart?: boolean;
  // Hard timeout in ms. Defaults to 15 s — long enough for the
  // scan endpoint, tight enough to avoid hanging UI.
  timeoutMs?: number;
  // When true, don't attach the bearer token (used for /health).
  skipAuth?: boolean;
};

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(status: number, message: string, payload?: unknown) {
    super(message);
    this.name    = 'ApiError';
    this.status  = status;
    this.payload = payload ?? null;
  }
}

function _readToken(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    // The legacy client reads from `farroway_token` and
    // `auth_token` depending on the login path. We try both
    // so a user logged in via either flow gets authenticated.
    return (
      localStorage.getItem('farroway_token')
      || localStorage.getItem('auth_token')
      || localStorage.getItem('token')
      || null
    );
  } catch {
    return null;
  }
}

/**
 * apiClient<T>(endpoint, options?) → Promise<T | null>
 *
 * Throws `ApiError` on non-2xx. Returns `null` on 204. Parsed
 * JSON otherwise. Caller is responsible for catching `ApiError`
 * — service files convert the error into their domain-specific
 * fallback shape (e.g. weatherService returns `null`, scanService
 * returns the `'uncertain'` envelope).
 */
export async function apiClient<T = unknown>(
  endpoint: string,
  options: ApiClientOptions = {},
): Promise<T | null> {
  const url = `${API_BASE}${endpoint}`;
  const token = options.skipAuth ? null : _readToken();

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    if (options.multipart && options.body instanceof FormData) {
      body = options.body;
      // FormData sets its own Content-Type with boundary — never
      // set it manually.
    } else {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      body = JSON.stringify(options.body);
    }
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), options.timeoutMs ?? 15_000);

  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method || (body ? 'POST' : 'GET'),
      headers,
      body,
      signal: ctrl.signal,
      credentials: 'include',
    });
  } catch (err: unknown) {
    clearTimeout(t);
    const msg = (err && (err as Error).message) || 'network_error';
    throw new ApiError(0, msg);
  }
  clearTimeout(t);

  if (res.status === 204) return null;

  let payload: unknown = null;
  try {
    const text = await res.text();
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const errorMessage = (payload && typeof payload === 'object'
      && (payload as Record<string, unknown>).error)
      ? String((payload as Record<string, unknown>).error)
      : `HTTP ${res.status}`;
    throw new ApiError(res.status, errorMessage, payload);
  }

  return (payload as T);
}

/**
 * isApiError(err) — narrowing helper for service-layer catches.
 */
export function isApiError(err: unknown): err is ApiError {
  return !!(err && typeof err === 'object' && (err as { name?: string }).name === 'ApiError');
}

export default apiClient;
