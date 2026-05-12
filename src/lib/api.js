// Gap C — production-safety: fail-fast at module load if the API
// base URL is missing in a production build. The helper throws with
// an actionable message so a misconfigured deploy crashes the bundle
// at startup rather than silently sending requests to same-origin.
import { resolveApiBase } from './api/assertApiBaseUrl.js';
import { isLoggedIn } from '../utils/session.js';
const API_BASE = resolveApiBase();

// Dev-only one-shot diagnostic per the runtime-stabilization spec
// (§2). Fires once per page load in development so a developer can
// confirm at a glance that the API base resolved cleanly. Suppressed
// in production to keep the user console quiet — the same-origin
// fallback is the documented Railway monolith pattern (handled in
// assertApiBaseUrl.js without warning) and shouldn't read as an error.
try {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
    if (typeof globalThis !== 'undefined' && !globalThis.__farrowayApiBaseLogged) {
      globalThis.__farrowayApiBaseLogged = true;
      // eslint-disable-next-line no-console
      console.log('[FARROWAY_API] base validated', { base: API_BASE || '(same-origin)' });
    }
  }
} catch { /* never throw from a diagnostic */ }

// P5.15 — re-export the normalizer so callers can `import { ...
// normalizeApiResponse, safeCall } from '../lib/api.js'` instead of
// having to know about the deeper module path.
export { normalizeApiResponse, safeCall } from './api/normalizeApiResponse.js';

// ─── Not-authenticated sentinel ──────────────────────────────────
// When the request layer detects "no active session" BEFORE firing,
// we synthesise the same Error shape a real 401 would produce, so
// existing callers that check `err.status === 401` keep working.
// The extra `notAuthenticated` flag lets callers distinguish a
// pre-flight gate from a server-issued 401 (useful for telemetry).
function _notAuthenticatedError() {
  const err = new Error('Not authenticated');
  err.status = 401;
  err.notAuthenticated = true;
  err.fieldErrors = {};
  return err;
}

async function parseJson(res) {
  let data = null;

  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err = new Error(data?.error || 'Request failed');
    err.status = res.status;
    err.fieldErrors = data?.fieldErrors || {};
    throw err;
  }

  return data;
}

// ─── Refresh lock ─────────────────────────────────────────
// Prevents multiple concurrent 401 responses from each triggering
// their own /refresh call. The first 401 acquires the lock, refreshes,
// and all other waiters reuse the same refresh result.
let _refreshPromise = null;

// ─── Refresh-failure cool-down ────────────────────────────
// When the refresh endpoint returns ANY non-OK status (401 = no
// refresh cookie, 429 = rate-limited, 5xx = server hiccup), we
// mark the session as dead and short-circuit every subsequent
// authenticated request until the user signs in again. This
// collapses the expired-session cascade visible in production
// (4 × 401s + 1 × 429 per page load → all silently gated after
// the first refresh attempt) without changing the visible UX:
// the UI already handles 401 calmly.
//
// Reset paths:
//   • markSessionAlive() — called by loginUser / verifyPhoneOtp /
//     refreshSession on a successful response.
//   • clearSessionDead() — exported for tests + AuthContext
//     re-bootstrap.
let _sessionDead = false;

// Throttle for the [Auth Loop Prevented] log — without this, every
// request after _sessionDead flips would log a line. We rate-limit
// to once per 5 s so the signal is greppable without flooding.
let _lastLoopLogAt = 0;
const _LOOP_LOG_WINDOW_MS = 5_000;

// Dispatched when _sessionDead flips false → true. AuthContext (or
// any other listener) can use this as a "hard logout" signal — clear
// local state, route to /login, etc. Idempotent within the same dead
// state; a second flip without an intervening alive doesn't fire.
//
//   window.addEventListener(SESSION_EXPIRED_EVENT, () => { … })
//
// Exported for typed consumers; the literal string is the contract.
export const SESSION_EXPIRED_EVENT = 'farroway:session_expired';

function _emitSessionExpired() {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
  } catch { /* never throw from a diagnostic */ }
}

function _markSessionDead() {
  if (_sessionDead) return; // idempotent — only fires the event once
  _sessionDead = true;
  _emitSessionExpired();
}

export function markSessionAlive() {
  _sessionDead = false;
}

export function isSessionDead() {
  return _sessionDead;
}

export function clearSessionDead() {
  _sessionDead = false;
}

async function refreshOnce() {
  if (_refreshPromise) return _refreshPromise;
  try { console.log('[Auth Refresh Start]'); } catch { /* swallow */ }
  _refreshPromise = fetch(`${API_BASE}/api/v2/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  }).finally(() => { _refreshPromise = null; });
  return _refreshPromise;
}

/**
 * Proactively refresh the access token.
 * Returns true if refresh succeeded, false otherwise.
 * Used by AuthContext bootstrap to pre-flight before /me.
 *
 * Mutates `_sessionDead`: marks dead on failure, alive on success.
 */
export async function refreshSession() {
  try {
    const res = await refreshOnce();
    if (res.ok) {
      try { console.log('[Auth Refresh Success]'); } catch { /* swallow */ }
      _sessionDead = false;
      return true;
    }
    try { console.log('[Auth Refresh Failed]', { status: res.status }); } catch { /* swallow */ }
    _markSessionDead();
    return false;
  } catch (err) {
    try { console.log('[Auth Refresh Failed]', { reason: err && err.message }); } catch { /* swallow */ }
    _markSessionDead();
    return false;
  }
}

async function request(path, options = {}, allowRefresh = true) {
  // Pre-flight session gate — only for endpoints that participate in
  // the refresh dance (allowRefresh === true, i.e. authenticated
  // endpoints). When there's no session at all (no farroway_token,
  // no session_cache mirror), skip the fetch entirely and synthesise
  // a 401. This collapses the "401 → refresh 401 → cascade" noise
  // that produced 4 reds in DevTools on every guest/expired boot.
  //
  // Endpoints that explicitly pass `allowRefresh: false` (login,
  // register, verify, forgot-password, OTP request/verify, recovery
  // probes, etc.) are UNAUTHENTICATED by definition — they MUST
  // still fire even when isLoggedIn() is false.
  if (allowRefresh && !isLoggedIn()) {
    throw _notAuthenticatedError();
  }

  // Second gate: once refresh has failed in this session, the access
  // token can't be revived without a fresh sign-in. Every subsequent
  // authenticated request short-circuits to keep the console quiet
  // and the network panel clean. Reset by markSessionAlive() on a
  // successful login / refresh.
  if (allowRefresh && _sessionDead) {
    // Throttled "loop prevented" log — fires at most once per 5 s so
    // ops can see the gate working without flooding DevTools.
    try {
      const now = Date.now();
      if (now - _lastLoopLogAt >= _LOOP_LOG_WINDOW_MS) {
        _lastLoopLogAt = now;
        console.log('[Auth Loop Prevented]', { path });
      }
    } catch { /* swallow */ }
    throw _notAuthenticatedError();
  }

  // Destructure headers out so ...rest doesn't overwrite the merged headers
  const { headers: optHeaders, ...rest } = options;
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(optHeaders || {}),
    },
  });

  if (res.status === 401 && allowRefresh) {
    try {
      const refreshRes = await refreshOnce();
      if (refreshRes.ok) {
        try { console.log('[Auth Refresh Success]'); } catch { /* swallow */ }
        _sessionDead = false;
        return request(path, options, false);
      }
      // Refresh returned a non-OK status (401 = no refresh cookie,
      // 429 = rate-limited, 5xx = server hiccup). Mark the session
      // dead so every subsequent authenticated request short-
      // circuits in the gate above — no more cascade. Use the
      // helper that emits the farroway:session_expired event so
      // AuthContext can pick up the hard-logout signal.
      try { console.log('[Auth Refresh Failed]', { status: refreshRes.status }); } catch { /* swallow */ }
      _markSessionDead();
    } catch (refreshErr) {
      // Refresh network failure — same outcome: short-circuit
      // future authenticated calls until the user signs in.
      try { console.log('[Auth Refresh Failed]', { reason: refreshErr && refreshErr.message }); } catch { /* swallow */ }
      _markSessionDead();
    }
  }

  return parseJson(res);
}

export function registerUser(payload) {
  return request('/api/v2/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function loginUser(payload) {
  const data = await request('/api/v2/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, false); // login 401 = wrong password, not an expired session
  // Successful login clears any prior session-dead flag so the
  // post-failure gate stops short-circuiting future calls.
  _sessionDead = false;
  return data;
}

export async function verifyMfaCode(payload) {
  const data = await request('/api/v2/auth/mfa/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, false);
  _sessionDead = false;
  return data;
}

export async function logoutUser() {
  const data = await request('/api/v2/auth/logout', {
    method: 'POST',
  }, false);
  // After logout, the next login will reset; pre-emptively mark
  // dead so any in-flight authenticated request from a previous
  // surface short-circuits cleanly.
  _sessionDead = true;
  return data;
}

export function getCurrentUser() {
  return request('/api/v2/auth/me');
}

export function verifyEmail(token) {
  return request('/api/v2/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  }, false);
}

export function resendVerification() {
  return request('/api/v2/auth/resend-verification', {
    method: 'POST',
  });
}

// ─── Phone + OTP authentication ────────────────────────────
export function requestPhoneOtp(phone) {
  return request('/api/v2/auth/otp/request', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  }, false);
}

export async function verifyPhoneOtp(phone, code) {
  const data = await request('/api/v2/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  }, false);
  // OTP verify is the SMS branch of "exchange credentials for a
  // session" — same reset semantics as loginUser.
  _sessionDead = false;
  return data;
}

export function forgotPassword(payload) {
  return request('/api/v2/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, false);
}

/**
 * getRecoveryMethods — unauthenticated probe that tells the UI
 * which reset paths are usable right now (email, sms). Used by
 * ForgotPassword to hide the "Use SMS instead" link when SMS is
 * not wired. Returns { email: boolean, sms: boolean }.
 */
export function getRecoveryMethods() {
  return request('/api/v2/auth/recovery-methods', { method: 'GET' }, false);
}

export function resetPassword(payload) {
  return request('/api/v2/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, false);
}

/**
 * verifyResetToken — pre-flight check used by ResetPassword on
 * mount. Returns `{ valid: boolean }` ONLY; never the user id,
 * email, or reason. The endpoint fails closed on every error mode
 * (missing token, wrong token, expired, used, inactive user, DB
 * blip) so the UI can decide between "show form" and "show
 * recovery CTA" without ever leaking enumeration data.
 *
 * Caller contract: returns `{ valid: false }` on network error
 * too (so the UI lands on the dead-link view rather than
 * crashing on a refresh from a captive-portal Wi-Fi).
 */
export async function verifyResetToken({ token }) {
  try {
    const data = await request('/api/v2/auth/verify-reset-token', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }, false);
    return { valid: !!(data && data.valid) };
  } catch {
    return { valid: false };
  }
}

// ─── SMS verification (provider-agnostic OTP) ──────────────
// Works for password reset, account recovery, and optional login
// verification. The server delegates to an active Twilio-Verify /
// Plivo / Infobip provider — the shape stays the same.

export function smsStartVerification({ phone, purpose, channel, locale } = {}) {
  return request('/api/auth/sms/start-verification', {
    method: 'POST',
    body: JSON.stringify({ phone, purpose, channel, locale }),
  }, false);
}

export function smsCheckVerification({ phone, code, purpose, newPassword } = {}) {
  return request('/api/auth/sms/check-verification', {
    method: 'POST',
    body: JSON.stringify({ phone, code, purpose, newPassword }),
  }, false);
}

export function getFarmProfile() {
  return request('/api/v2/farm-profile');
}

/**
 * canonicalizeFarmPayload(payload)
 *   Boundary helper for the farm-profile write path.
 *
 *   Pilot diagnostic (Apr 2026) showed the deployed server still
 *   validates the legacy field name as required. The previous
 *   version stripped that field from the payload, causing every
 *   POST to fail with "required" validation errors. Fix: mirror
 *   both names in the outgoing body so old + new servers both
 *   accept it. No double-write risk — both fields carry the
 *   same canonical id.
 */
function canonicalizeFarmPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const out = { ...payload };
  const LEGACY = 'cropType';
  if (out.crop == null && out[LEGACY] != null) {
    out.crop = out[LEGACY];
  } else if (out[LEGACY] == null && out.crop != null) {
    out[LEGACY] = out.crop;
  }
  return out;
}

export function saveFarmProfile(payload, { headers } = {}) {
  const body = canonicalizeFarmPayload(payload);

  // PRE-FLIGHT GUARD (Apr 2026, after pilot 400 with cropType
  // required). Even after canonicalize mirrors both field names,
  // the server rejects when the value is empty. If the caller
  // didn't supply a crop, blocking the POST locally is preferable
  // to spamming the server + ErrorBoundary. Throws a structured
  // client error so the caller's existing catch handler can react
  // (show a "pick a crop first" message, etc.).
  const cropValue = body && (body.crop || body.cropType);
  if (!cropValue || (typeof cropValue === 'string' && !cropValue.trim())) {
    const err = new Error('Crop type is required');
    err.status = 400;
    err.fieldErrors = { cropType: 'Crop type is required' };
    err.skippedNetwork = true;  // signals "we didn't even try"
    try {
      console.warn(
        '[saveFarmProfile skipped] empty crop — payload fields:',
        body && typeof body === 'object' ? Object.keys(body).join(', ') : '(non-object)',
      );
    } catch { /* ignore */ }
    return Promise.reject(err);
  }

  // DIAGNOSTIC: surface the exact server rejection reason when
  // farm-profile POSTs return non-2xx. The browser's automatic
  // `Failed to load resource: 400` console log doesn't show the
  // field-level error from the server — past pilot screenshots
  // showed only the generic 400 line, with no diagnostic info to
  // act on. With this wrap, the next failure prints:
  //   [saveFarmProfile 400] <server msg> — payload fields: a, b, c
  //                                      — fieldErrors: { ... }
  // Field VALUES are deliberately not logged (PII safety); only
  // the field NAMES + the server's structured fieldErrors response.
  return request('/api/v2/farm-profile', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: headers || {},
  }).catch((err) => {
    try {
      const fieldNames = body && typeof body === 'object'
        ? Object.keys(body).join(', ')
        : '(non-object)';
      console.error(
        '[saveFarmProfile ' + (err && err.status ? err.status : '?') + ']',
        (err && err.message) || 'unknown',
        '— payload fields:', fieldNames,
        '— fieldErrors:', (err && err.fieldErrors) || {},
      );
    } catch { /* never propagate from diagnostic */ }
    throw err;
  });
}

export function saveFarmerType(farmerType) {
  return request('/api/v2/farm-profile/farmer-type', {
    method: 'POST',
    body: JSON.stringify({ farmerType }),
  });
}

// ─── Multi-Farm Support ─────────────────────────────────
export function getFarms() {
  return request('/api/v2/farm-profile/list');
}

export function createNewFarm(payload) {
  return request('/api/v2/farm-profile/new', {
    method: 'POST',
    body: JSON.stringify(canonicalizeFarmPayload(payload)),
  });
}

export function switchActiveFarm(farmId) {
  return request(`/api/v2/farm-profile/${farmId}/activate`, {
    method: 'POST',
  });
}

export function setDefaultFarm(farmId) {
  return request(`/api/v2/farm-profile/${farmId}/set-default`, {
    method: 'POST',
  });
}

export function deactivateFarm(farmId) {
  return request(`/api/v2/farm-profile/${farmId}/deactivate`, {
    method: 'POST',
  });
}

export function archiveFarm(farmId) {
  return request(`/api/v2/farm-profile/${farmId}/archive`, {
    method: 'POST',
  });
}

// Task engine version — bump to invalidate cached tasks and force regeneration.
// Incrementing this causes the server to regenerate tasks instead of serving stale cache.
const TASK_ENGINE_VERSION = 2;

export function getFarmTasks(farmId, stage) {
  const params = new URLSearchParams();
  if (stage) params.set('stage', stage);
  params.set('v', String(TASK_ENGINE_VERSION));
  const qs = params.toString();
  return request(`/api/v2/farm-tasks/${farmId}/tasks?${qs}`);
}

export function completeTask(farmId, taskId, body = {}) {
  return request(`/api/v2/farm-tasks/${farmId}/tasks/${encodeURIComponent(taskId)}/complete`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateFarm(farmId, payload) {
  return request(`/api/v2/farm-profile/${farmId}`, {
    method: 'PATCH',
    body: JSON.stringify(canonicalizeFarmPayload(payload)),
  });
}

export function updateCropStage(farmId, cropStage, plantedAt) {
  const body = { cropStage };
  if (plantedAt !== undefined) body.plantedAt = plantedAt;
  return request(`/api/v2/farm-profile/${farmId}/stage`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function getFarmStage(farmId) {
  return request(`/api/v2/farm-profile/${farmId}/stage`);
}

export function getSeasonalTiming(farmId) {
  return request(`/api/v2/farm-profile/${farmId}/seasonal-timing`);
}

export function updateSeasonalTiming(farmId, payload) {
  return request(`/api/v2/farm-profile/${farmId}/seasonal-timing`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function getCurrentWeather({ lat, lng, location } = {}) {
  const params = new URLSearchParams();
  if (lat != null && lng != null) {
    params.set('lat', lat);
    params.set('lng', lng);
  }
  if (location) params.set('location', location);
  return request(`/api/v2/weather/current?${params.toString()}`);
}

export function getFarmWeather(farmId) {
  return request(`/api/v2/farm-weather/${encodeURIComponent(farmId)}`);
}

export function getFarmRisks(farmId) {
  return request(`/api/v2/farm-risks/${encodeURIComponent(farmId)}`);
}

export function getFarmInputs(farmId) {
  return request(`/api/v2/farm-inputs/${encodeURIComponent(farmId)}`);
}

export function getFarmHarvest(farmId) {
  return request(`/api/v2/farm-harvest/${encodeURIComponent(farmId)}`);
}

// ─── Harvest Records (yield logging) ─────────────────────
export function getHarvestRecords(farmId) {
  return request(`/api/v2/harvest-records/${encodeURIComponent(farmId)}`);
}

export function createHarvestRecord(payload) {
  return request('/api/v2/harvest-records', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateHarvestRecord(id, payload) {
  return request(`/api/v2/harvest-records/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteHarvestRecord(id) {
  return request(`/api/v2/harvest-records/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ─── Farm Costs (expense tracking) ───────────────────────
export function getFarmCosts(farmId) {
  return request(`/api/v2/farm-costs/${encodeURIComponent(farmId)}`);
}

export function createFarmCost(payload) {
  return request('/api/v2/farm-costs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateFarmCost(id, payload) {
  return request(`/api/v2/farm-costs/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteFarmCost(id) {
  return request(`/api/v2/farm-costs/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function getFarmEconomics(farmId) {
  return request(`/api/v2/farm-costs/${encodeURIComponent(farmId)}/economics`);
}

// ─── Weekly Summary (decision digest) ───────────────────
export function getWeeklySummary(farmId) {
  return request(`/api/v2/weekly-summary/${encodeURIComponent(farmId)}`);
}

// ─── Farm Benchmarks (season-over-season) ────────────────
export function getFarmBenchmarks(farmId, mode = 'season') {
  const qs = mode ? `?mode=${encodeURIComponent(mode)}` : '';
  return request(`/api/v2/farm-benchmarks/${encodeURIComponent(farmId)}${qs}`);
}

export function getActiveSeason(farmId) {
  const qs = farmId ? `?farmId=${encodeURIComponent(farmId)}` : '';
  return request(`/api/v2/seasons/active${qs}`);
}

export function startSeason(payload) {
  return request('/api/v2/seasons/start', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function completeSeason(seasonId) {
  return request(`/api/v2/seasons/${seasonId}/complete`, {
    method: 'POST',
  });
}

// Legacy completeTask (V2Task model) — kept for backward compat
export function completeV2Task(taskId) {
  return request(`/api/v2/tasks/${taskId}/complete`, {
    method: 'POST',
  });
}

// Cheap auth-presence probe used by the analytics fire-and-forget
// helpers. We can't read the V2 httpOnly access cookie from JS, so
// the next-best signal is the localStorage session-cache mirror
// that AuthContext writes on every successful /me. If neither the
// V1 admin token nor the V2 session cache is present the user is
// almost certainly logged out — firing /analytics/track in that
// state guarantees a 401 and surfaces an unsuppressable
// "Failed to load resource" line in the browser console.
function _hasAuthSignal() {
  try {
    if (typeof localStorage === 'undefined') return false;
    if (localStorage.getItem('farroway_token')) return true;
    if (localStorage.getItem('farroway:session_cache')) return true;
    return false;
  } catch { return false; }
}

export function trackEvent(event, metadata) {
  // Guard: avoid the guaranteed-401 call from anonymous routes
  // (login / forgot-password / public landing). A logged-out
  // farmer never has a valid analytics session anyway, so the
  // call is a pure browser-console-noise generator. Caller still
  // gets a thenable so existing `.then` chains don't crash.
  if (!_hasAuthSignal()) {
    return Promise.resolve({ skipped: true, reason: 'no_auth' });
  }
  return request('/api/v2/analytics/track', {
    method: 'POST',
    body: JSON.stringify({ event, metadata }),
  });
}

/**
 * Fire-and-forget pilot event tracker.
 * Logs to the analytics endpoint but never throws or blocks the caller.
 */
export function trackPilotEvent(event, metadata = {}) {
  // Same anonymous-skip as trackEvent above. The previous shape
  // fired the request, the server returned 401, and the browser
  // logged "Failed to load resource: .../analytics/track 401" on
  // every public-route render. The fire-and-forget catch swallows
  // the JS error but cannot suppress the browser's own console
  // line — gating the call is the only way to silence the noise.
  if (!_hasAuthSignal()) return;
  try {
    request('/api/v2/analytics/track', {
      method: 'POST',
      body: JSON.stringify({ event, metadata, source: 'pilot' }),
    }).catch(() => {});
  } catch {
    // silently ignore — analytics must never block the UI
  }
}

export function createSupportRequest(payload) {
  return request('/api/v2/support/request', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function healthCheck() {
  return request('/api/v2/monitoring/health', { method: 'GET' }, false);
}

// ─── Land Boundaries ──────────────────────────────────────────
export function getLandBoundaries(farmId) {
  const qs = farmId ? `?farmId=${encodeURIComponent(farmId)}` : '';
  return request(`/api/v2/land-boundaries${qs}`);
}

export function saveLandBoundary(payload) {
  return request('/api/v2/land-boundaries', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteLandBoundary(id) {
  return request(`/api/v2/land-boundaries/${id}`, { method: 'DELETE' });
}

// ─── Seed Scans ───────────────────────────────────────────────
export function getSeedScans(farmId) {
  const qs = farmId ? `?farmId=${encodeURIComponent(farmId)}` : '';
  return request(`/api/v2/seed-scans${qs}`);
}

export function saveSeedScan(payload) {
  return request('/api/v2/seed-scans', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ─── Verification Signals ─────────────────────────────────────
export function getVerificationSignals() {
  return request('/api/v2/verification-signals');
}

// ─── Supply Readiness ────────────────────────────────────────
export function getMySupplyReadiness() {
  return request('/api/v2/supply-readiness/mine');
}

export function saveSupplyReadiness(payload) {
  return request('/api/v2/supply-readiness/mine', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getAdminSupplyList(params = {}) {
  const qs = new URLSearchParams();
  if (params.readyOnly) qs.set('readyOnly', 'true');
  if (params.crop) qs.set('crop', params.crop);
  const q = qs.toString();
  return request(`/api/v2/supply-readiness/admin/list${q ? '?' + q : ''}`);
}

export function connectSupplyToBuyer(id) {
  return request(`/api/v2/supply-readiness/admin/${id}/connect`, { method: 'POST' });
}

export function exportSupplyCSV(params = {}) {
  const qs = new URLSearchParams();
  if (params.readyOnly) qs.set('readyOnly', 'true');
  const q = qs.toString();
  // Returns raw fetch for CSV download
  return fetch(`${API_BASE}/api/v2/supply-readiness/admin/export.csv${q ? '?' + q : ''}`, {
    credentials: 'include',
  });
}

// ─── Buyers (admin) ──────────────────────────────────────────
export function getBuyers(params = {}) {
  const qs = new URLSearchParams();
  if (params.crop) qs.set('crop', params.crop);
  if (params.search) qs.set('search', params.search);
  const q = qs.toString();
  return request(`/api/v2/buyers${q ? '?' + q : ''}`);
}

export function getBuyer(id) {
  return request(`/api/v2/buyers/${id}`);
}

export function createBuyer(payload) {
  return request('/api/v2/buyers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateBuyer(id, payload) {
  return request(`/api/v2/buyers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

// ─── Buyer Trust (buyer-ready farm view) ────────────────────────
export function getBuyerTrustFarms(params = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  const q = qs.toString();
  return request(`/api/v2/buyer-trust/farms${q ? '?' + q : ''}`);
}

export function getBuyerTrustFarm(farmerId) {
  return request(`/api/v2/buyer-trust/farms/${farmerId}`);
}

// ─── Buyer Links (admin) ─────────────────────────────────────
export function getBuyerLinks(params = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.supplyId) qs.set('supplyId', params.supplyId);
  if (params.buyerId) qs.set('buyerId', params.buyerId);
  const q = qs.toString();
  return request(`/api/v2/buyer-links${q ? '?' + q : ''}`);
}

export function createBuyerLink(payload) {
  return request('/api/v2/buyer-links', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateBuyerLink(id, payload) {
  return request(`/api/v2/buyer-links/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function exportBuyerLinksCSV(params = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  const q = qs.toString();
  return fetch(`${API_BASE}/api/v2/buyer-links/export.csv${q ? '?' + q : ''}`, {
    credentials: 'include',
  });
}
