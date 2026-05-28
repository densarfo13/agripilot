/**
 * useApiClient.js — Wave 2 RUNTIME hook.
 *
 *   import { useApiClient } from 'src/hooks/useApiClient.js';
 *   const { api, formatApiError } = useApiClient();
 *
 * What this is
 * ────────────
 *   The React-side entry point to the RUNTIME-governed API client.
 *   Components that need to make ad-hoc requests (admin tools, one-
 *   off mutations) call this hook instead of importing the
 *   infrastructure axios instance directly.
 *
 *   For STATIC imports (e.g. utility files that aren't React
 *   components — `lib/...`, `services/...`) prefer
 *   `import api from 'src/runtime/apiRuntime.js'` directly.
 *
 *   This hook exists so future waves can:
 *     • return memoized retry helpers
 *     • subscribe components to a "fetch in flight" indicator
 *     • bridge auth-refresh state into render scope
 *   without requiring every component to re-wire.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe (hook body is React-only).
 *   • Returns a STABLE reference per render so dependency arrays in
 *     calling components don't churn.
 *   • Wraps the runtime facade — does NOT bypass it.
 *   • RUNTIME → RUNTIME import (allowed).
 */

import { useMemo } from 'react';
import api, {
  formatApiError, getApiRuntimeTelemetry,
} from '../runtime/apiRuntime.js';

const _STABLE = Object.freeze({ api, formatApiError, getApiRuntimeTelemetry });

export function useApiClient() {
  return useMemo(() => _STABLE, []);
}

const _module = { useApiClient };
export default _module;
