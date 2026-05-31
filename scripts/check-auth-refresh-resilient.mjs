#!/usr/bin/env node
/**
 * scripts/check-auth-refresh-resilient.mjs — Phase 2/4/5 gate.
 *
 * `POST /api/v2/auth/refresh -> 429` must never block rendering or log
 * the user out. This gate enforces the soft-auth-degraded contract:
 *   • refreshSession() is bounded by withBootstrapTimeout in
 *     AuthContext.bootstrap() (can't block the auth gate).
 *   • lib/api.js treats a TRANSIENT refresh status (429 / 5xx /
 *     network) as degraded mode — it does NOT _markSessionDead for
 *     those — and schedules a background backoff retry.
 *   • window.__authRefreshHealth() + window.__startupHealth() exist
 *     and are wired.
 *
 * Read-only. Never mutates source.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
const fail = (m) => FAILED.push(m);
const pass = (m) => PASSED.push(m);
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

// ─── 1. Refresh is bounded in bootstrap (can't block the gate) ──
const auth = read('src/context/AuthContext.jsx');
if (!auth) {
  fail('auth-ctx: src/context/AuthContext.jsx missing');
} else if (!/withBootstrapTimeout\(\s*refreshSession\(\)/.test(auth)) {
  fail('auth-ctx: refreshSession() must be wrapped in withBootstrapTimeout (must not block the auth gate)');
} else {
  pass('auth-ctx: refreshSession() is bounded by withBootstrapTimeout');
}

// ─── 2. api.js — transient → degraded, not dead ────────────────
const api = read('src/lib/api.js');
if (!api) {
  fail('api: src/lib/api.js missing');
} else {
  for (const tok of ['_isTransientStatus', '_enterDegraded', '_clearDegraded',
                     'getAuthRefreshSnapshot', '_DEGRADED_BACKOFF_MS', 'degradedMode']) {
    if (!new RegExp(`\\b${tok}\\b`).test(api)) {
      fail(`api: lib/api.js must define "${tok}" (soft-auth-degraded mode)`);
    }
  }
  // 429 / 5xx must be recognised as transient.
  if (!/===\s*429/.test(api)) {
    fail('api: _isTransientStatus must recognise 429');
  }
  if (!/>=\s*500\b/.test(api)) {
    fail('api: _isTransientStatus must recognise 5xx');
  }
  // The refresh-failure path must branch on _isTransientStatus and
  // call _enterDegraded BEFORE / instead of an unconditional
  // _markSessionDead. Assert both the transient branch and that
  // _enterDegraded is reachable from a refresh failure.
  if (!/_isTransientStatus\(\s*res\.status\s*\)[\s\S]{0,120}_enterDegraded\(\)/.test(api)
      && !/_isTransientStatus\(\s*refreshRes\.status\s*\)[\s\S]{0,160}_enterDegraded\(\)/.test(api)) {
    fail('api: a transient refresh status must route to _enterDegraded() (not _markSessionDead)');
  }
  if (FAILED.filter((f) => f.startsWith('api:')).length === 0) {
    pass('api: 429/5xx refresh failures enter degraded mode (no hard logout) + background backoff');
  }
}

// ─── 3. __authRefreshHealth present + wired ────────────────────
const refreshRt = read('src/runtime/authRefresh/AuthRefreshHealthRuntime.ts');
for (const tok of ['__authRefreshHealth', 'refreshAttempts', 'refreshFailures',
                   'degradedMode', 'routeShellLoaded']) {
  if (!new RegExp(`\\b${tok}\\b`).test(refreshRt)) {
    fail(`diag: AuthRefreshHealthRuntime must surface "${tok}"`);
  }
}

// ─── 4. __startupHealth present + wired ────────────────────────
const startupRt = read('src/runtime/startup/StartupHealthRuntime.ts');
for (const tok of ['__startupHealth', 'routeMatched', 'routeLoaded',
                   'suspenseResolved', 'authLoaded', 'profileLoaded', 'scanShellLoaded']) {
  if (!new RegExp(`\\b${tok}\\b`).test(startupRt)) {
    fail(`diag: StartupHealthRuntime must surface "${tok}"`);
  }
}

const app = read('src/App.jsx');
if (!/installAuthRefreshHealthGlobal/.test(app)) {
  fail('wiring: App.jsx must wire installAuthRefreshHealthGlobal');
}
if (!/installStartupHealthGlobal/.test(app)) {
  fail('wiring: App.jsx must wire installStartupHealthGlobal');
}
if (!FAILED.some((f) => f.startsWith('diag:') || f.startsWith('wiring:'))) {
  pass('diag: __authRefreshHealth + __startupHealth present + wired');
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:auth-refresh-resilient] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:auth-refresh-resilient] PASS — refresh bounded, 429/5xx degrades (no logout), startup observable.');
for (const p of PASSED) console.log('  ✓ ' + p);
