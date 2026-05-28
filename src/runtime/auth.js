/**
 * runtime/auth.js — Wave 4 RUNTIME facade for the auth/lib-API surface.
 *
 *   import { loginUser, registerUser, formatApiError }
 *     from 'src/runtime/auth.js';
 *
 * What this is
 * ────────────
 *   The RUNTIME-layer entry point for the cookie-auth fetch wrapper
 *   at `src/lib/api.js`. Pages/components import here instead of
 *   the underlying service module.
 *
 *   Architecture chain (post-wave-4):
 *     UI / hook  →  src/runtime/auth.js   (this file, RUNTIME)
 *                →  src/lib/api.js        (SERVICE, reclassified in wave 4)
 *                →  src/api/client.js     (INFRASTRUCTURE)
 *
 *   lib/api.js was reclassified from INFRASTRUCTURE to SERVICE in
 *   wave 4 because it is architecturally a side-effect owner (HTTP
 *   request wrapper + auth refresh), not an external integration.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Zero behavior change vs. direct `lib/api.js` import.
 *   • RUNTIME → SERVICE (allowed by ALLOWED_IMPORTS).
 */

export * from '../lib/api.js';
