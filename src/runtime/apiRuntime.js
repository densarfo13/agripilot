/**
 * apiRuntime.js — Wave 2 RUNTIME facade for outbound API access.
 *
 *   import api, { formatApiError } from 'src/runtime/apiRuntime.js';
 *
 * What this is
 * ────────────
 *   The RUNTIME-layer entry point for UI surfaces that need to make
 *   HTTP requests. Pages/components must not import the underlying
 *   infrastructure axios instance (`src/api/client.js`) directly —
 *   they import here, and this module forwards to the SERVICE-layer
 *   gateway at `src/services/api/apiGateway.js`.
 *
 *   Chain:
 *     UI / hook  →  src/runtime/apiRuntime.js   (this file, RUNTIME)
 *                →  src/services/api/apiGateway.js (SERVICE)
 *                →  src/api/client.js               (INFRASTRUCTURE)
 *
 *   This obeys the layer rule `RUNTIME → SERVICE → INFRASTRUCTURE`.
 *   `RUNTIME → INFRASTRUCTURE` is NOT in ALLOWED_IMPORTS — the
 *   gateway is the indirection.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Zero behavior change — same axios instance, same formatter.
 *   • RUNTIME → SERVICE import (allowed).
 */

import gatewayApi, {
  formatApiError,
  getApiGatewayTelemetry,
  getApiOwnershipSnapshot,
} from '../services/api/apiGateway.js';

export { formatApiError };
// Re-expose the telemetry under runtime-flavored names so the
// DevTools diagnostics can pull from one place.
export const getApiRuntimeTelemetry = getApiGatewayTelemetry;
export const getApiRuntimeOwnership = getApiOwnershipSnapshot;
export default gatewayApi;

const _module = {
  default: gatewayApi,
  formatApiError,
  getApiRuntimeTelemetry,
  getApiRuntimeOwnership,
};
export { _module as _internal };
