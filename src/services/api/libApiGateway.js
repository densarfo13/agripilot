/**
 * libApiGateway.js — SERVICE-layer indirection for the cookie-auth
 * fetch wrapper at src/lib/api.js.
 *
 * What this is
 * ────────────
 *   The architecture rule disallows `RUNTIME → INFRASTRUCTURE` —
 *   the permitted path is `RUNTIME → SERVICE → INFRASTRUCTURE`.
 *   This file is the SERVICE half for the lib/api.js facade.
 *
 *   It re-exports every named binding from the underlying module
 *   verbatim — no transformation, no extra behavior. Future waves
 *   can add request telemetry / retry / queue plumbing here in
 *   ONE place instead of touching every page.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Zero behavior change vs. direct `lib/api.js` import.
 *   • SERVICE → INFRASTRUCTURE (allowed by ALLOWED_IMPORTS).
 */

export * from '../../lib/api.js';
