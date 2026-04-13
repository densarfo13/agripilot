import axios from 'axios';
import { useAuthStore } from '../store/authStore.js';
import { useOrgStore } from '../store/orgStore.js';
import { generateUUID } from '../utils/generateId.js';

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

// Classify a raw axios error into a user-friendly message string.
// Handles network errors, timeouts, and server-sent error payloads.
export function formatApiError(err, fallback = 'Something went wrong. Please try again.') {
  if (!err.response) {
    // No response received — connectivity or timeout issue
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
  return err.response?.data?.error || err.message || fallback;
}

// Response interceptor: 401 logout + network error tagging + GET auto-retry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    if (error.response?.status === 401) {
      const code = error.response?.data?.code;
      // Step-up required — show modal, do NOT logout
      if (code === 'STEP_UP_REQUIRED' || code === 'STEP_UP_EXPIRED') {
        useAuthStore.getState().setStepUpRequired(true);
        return Promise.reject(error);
      }
      // MFA setup/challenge required — user has limited token; do NOT logout so they can enroll
      if (code === 'MFA_SETUP_REQUIRED' || code === 'MFA_CHALLENGE_REQUIRED') {
        return Promise.reject(error);
      }

      // Only logout + redirect for V1 (Bearer token) routes.
      // V2 routes use cookie auth via lib/api.js which handles its own 401→refresh flow.
      // Hard redirecting here would cause a page-reload blink for V2 users.
      const path = window.location.pathname;
      const isV2Route = path.startsWith('/dashboard') || path.startsWith('/login')
        || path.startsWith('/register') || path.startsWith('/season')
        || path.startsWith('/profile') || path.startsWith('/pest-')
        || path.startsWith('/field-') || path.startsWith('/regional-')
        || path.startsWith('/treatment-') || path.startsWith('/forgot-')
        || path.startsWith('/reset-') || path.startsWith('/verify-');
      if (!isV2Route) {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
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
