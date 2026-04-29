import axios from 'axios';
import { useAuthStore } from '../store/authStore.js';
import { useOrgStore } from '../store/orgStore.js';
import { generateUUID } from '../utils/generateId.js';
import { enqueueStepUpRetry } from '../core/auth/stepUpRetryQueue.js';

// Detect native platform: Capacitor injects window.Capacitor on native
// isNativePlatform can be a function (returns bool) or a boolean depending on version
const cap = typeof window !== 'undefined' && window.Capacitor;
const isNative = cap && (typeof cap.isNativePlatform === 'function' ? cap.isNativePlatform() : !!cap.isNativePlatform);

// On native (Android/iOS), API calls must go to the server's full URL.
// On web, relative '/api' works via Vite proxy or Express production serving.
// VITE_API_URL can be set at build time for native or custom deployments.
const API_BASE = isNative
  ? (import.meta.env.VITE_API_URL || 'https://farroway.app/api')
  : (import.meta.env.VITE_API_URL || '/api');

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // Send httpOnly cookies for V2 cookie auth
});

// Attach token + idempotency key to every mutation request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Auto-attach idempotency key for mutation requests (POST/PUT/PATCH)
  // Enables safe retry on network failures
  if (['post', 'put', 'patch'].includes(config.method)) {
    if (!config.headers['X-Idempotency-Key']) {
      config.headers['X-Idempotency-Key'] = generateUUID();
    }
  }

  // Attach orgId for super_admin org scoping (backend reads ?orgId= query param)
  const selectedOrgId = useOrgStore.getState().selectedOrgId;
  if (selectedOrgId) {
    config.params = config.params || {};
    if (!config.params.orgId) {
      config.params.orgId = selectedOrgId;
    }
  }

  return config;
});

// Classify a raw error (axios OR the fetch-based src/lib/api.js
// wrapper) into a user-friendly message string. Handles network
// errors, timeouts, and server-sent error payloads — and, crucially
// for the farm form, surfaces the backend's per-field validation
// summary instead of a generic "Validation failed".
export function formatApiError(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;

  // Fetch-wrapper shape: err.status + err.fieldErrors + err.message.
  // No .response property, but status IS present — treat as a real
  // server response, not a connectivity failure.
  if (err.status && !err.response) {
    if (err.status === 429) {
      return 'Too many requests — please wait a moment and try again.';
    }
    const fe = err.fieldErrors;
    if (fe && typeof fe === 'object') {
      const summary = Object.entries(fe)
        .map(([k, v]) => `${prettyField(k)}: ${v}`)
        .join('; ');
      if (summary) return summary;
    }
    return err.message || fallback;
  }

  if (!err.response) {
    // No response received AND no status — genuine connectivity issue.
    return 'No network connection — check your signal and try again.';
  }
  // Rate limited — show user-friendly message with retry hint
  if (err.response.status === 429) {
    const retryAfter = err.response.headers?.['retry-after'];
    const seconds = retryAfter ? parseInt(retryAfter, 10) : null;
    return seconds
      ? `Too many requests — please wait ${seconds} seconds and try again.`
      : 'Too many requests — please wait a moment and try again.';
  }
  // Axios: prefer the backend's fieldErrors summary when present.
  const fe = err.response?.data?.fieldErrors;
  if (fe && typeof fe === 'object') {
    const summary = Object.entries(fe)
      .map(([k, v]) => `${prettyField(k)}: ${v}`)
      .join('; ');
    if (summary) return summary;
  }
  return err.response?.data?.error || err.response?.data?.message
    || err.message || fallback;
}

// Map server field keys → human-readable labels for the error
// summary. Unknown keys pass through as-is (lowercased).
function prettyField(key) {
  const MAP = {
    farmerName: 'Farmer name',
    farmName:   'Farm name',
    country:    'Country',
    location:   'Location',
    cropType:   'Crop',
    crop:       'Crop',
    size:       'Farm size',
    farmSize:   'Farm size',
    sizeUnit:   'Size unit',
    stateCode:  'State',
    state:      'State',
    farmType:   'Farm type',
    cropStage:  'Crop stage',
  };
  return MAP[key] || String(key || '').trim();
}

// Response interceptor: 401 logout + network error tagging + GET auto-retry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    if (error.response?.status === 401) {
      const code = error.response?.data?.code;
      // Step-up required — show modal, do NOT logout.
      // If the request wasn't already retried post step-up, park
      // it on the retry queue and return the pending promise so
      // the admin page auto-refetches once the user verifies.
      if (code === 'STEP_UP_REQUIRED' || code === 'STEP_UP_EXPIRED') {
        useAuthStore.getState().setStepUpRequired(true);
        if (!config._stepUpRetried) {
          return enqueueStepUpRetry(config);
        }
        return Promise.reject(error);
      }
      // MFA setup/challenge required — user has limited token; do NOT logout so they can enroll
      if (code === 'MFA_SETUP_REQUIRED' || code === 'MFA_CHALLENGE_REQUIRED') {
        return Promise.reject(error);
      }

      // Before hard logout, try a v2 cookie refresh. The
      // refresh cookie is long-lived (1 year by default,
      // see server/lib/cookies.js) so an active farmer
      // almost always has a valid one. We try the refresh
      // up to 2 times with a tiny back-off — a transient
      // network blip should NEVER kick a farmer out.
      if (!config._refreshing) {
        config._refreshing = true;
        const refreshUrl = `${API_BASE.replace('/api', '')}/api/v2/auth/refresh`;
        let refreshOk      = false;
        let refreshHadResp = false;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            const refreshRes = await fetch(refreshUrl, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
            });
            refreshHadResp = true;
            if (refreshRes.ok) { refreshOk = true; break; }
            // Definitive 401 from refresh = session truly
            // invalid; no point retrying.
            if (refreshRes.status === 401) break;
          } catch {
            // Network error (offline, DNS, CORS): wait a beat
            // and retry. Don't logout on this.
            await new Promise((r) => setTimeout(r, 400));
          }
        }
        config._refreshing = false;

        if (refreshOk) {
          // Refresh succeeded — retry the original request.
          return api(config);
        }

        // If the refresh attempt NEVER got a real HTTP
        // response (pure network error), reject WITHOUT
        // logging the user out. The page will surface a
        // network error notice; the next call after
        // reconnection refreshes successfully and the
        // farmer stays signed in.
        if (!refreshHadResp) {
          error.isNetworkError = true;
          return Promise.reject(error);
        }
      }

      // Refresh got a definitive 401 (or two attempts both
      // failed with HTTP errors). Session is truly invalid.
      // Clear the auth store + redirect, BUT only when we're
      // not already on a public auth route — otherwise a 401
      // from /me on /login would loop the browser back to
      // /login forever.
      useAuthStore.getState().logout();
      try {
        const here = (typeof window !== 'undefined' && window.location)
          ? String(window.location.pathname || '/')
          : '/';
        const PUBLIC_AUTH = [
          '/login', '/register', '/forgot-password', '/reset-password',
          '/verify-otp', '/welcome', '/landing', '/start',
        ];
        const onAuthPage = PUBLIC_AUTH.some(
          (p) => here === p || here.startsWith(p + '/'),
        );
        if (!onAuthPage && typeof window !== 'undefined' && window.location) {
          // Preserve where the user was so /login can return them after
          // re-auth. Avoids the "I clicked into farmers, got bounced to
          // login, then dumped on the dashboard" papercut.
          const ret = `${here}${window.location.search || ''}`;
          window.location.href = `/login?from=${encodeURIComponent(ret)}`;
        }
      } catch { /* never throw from a recovery handler */ }
      return Promise.reject(error);
    }

    // Tag network errors so callers and formatApiError can detect them
    const isNetworkError = !error.response;
    if (isNetworkError) {
      error.isNetworkError = true;
    }

    // Auto-retry safe (GET) requests on network failure — up to 2 attempts,
    // with linear back-off (1 s, 2 s). POST/PATCH already carry idempotency
    // keys so callers can manually retry those if needed.
    if (isNetworkError && config?.method === 'get') {
      config._retryCount = (config._retryCount || 0) + 1;
      if (config._retryCount <= 2) {
        await new Promise(r => setTimeout(r, 1000 * config._retryCount));
        return api(config);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
