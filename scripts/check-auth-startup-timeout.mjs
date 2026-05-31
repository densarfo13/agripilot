#!/usr/bin/env node
/**
 * scripts/check-auth-startup-timeout.mjs — Global Startup + Routing
 * Deadlock Fix §3/§10 gate.
 *
 * The whole app is gated on authLoading (AuthLoadingGate). If
 * AuthContext.bootstrap() can hang, the full-screen spinner renders
 * forever. This gate enforces the permanent hard-stop:
 *   • an absolute auth-gate hard-stop timer scheduled BEFORE any await
 *   • the repair dynamic-imports are bounded (withBootstrapTimeout)
 *   • bootstrap timing is recorded for __authStartupHealth()
 *   • the __authStartupHealth diagnostic exists + is wired
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

// ─── 1. AuthContext hard-stop + bounded repairs ────────────────
const auth = read('src/context/AuthContext.jsx');
if (!auth) {
  fail('auth: src/context/AuthContext.jsx must exist');
} else {
  if (!/_authGateHardStop/.test(auth) || !/_releaseAuthGate/.test(auth)) {
    fail('auth: bootstrap() must schedule an absolute auth-gate hard-stop');
  } else {
    pass('auth: absolute auth-gate hard-stop present');
  }
  // Hard-stop must be an 8s ceiling per spec §3. The lazy [\s\S]*?
  // matches from the setTimeout opening to the nearest `, 8000)`.
  if (!/_authGateHardStop\s*=\s*setTimeout\([\s\S]*?,\s*8000\s*\)/.test(auth)) {
    fail('auth: hard-stop must use the 8000ms ceiling');
  } else {
    pass('auth: hard-stop uses the 8000ms ceiling');
  }
  // The repairActiveContext dynamic-import must be bounded — a stalled
  // chunk fetch on iOS Safari must not hold the gate closed.
  if (/await\s+import\(\s*['"]\.\.\/utils\/repairActiveContext\.js['"]\s*\)/.test(auth)) {
    fail('auth: repairActiveContext import must be bounded by withBootstrapTimeout');
  } else {
    pass('auth: repair dynamic-imports are bounded');
  }
  // Bootstrap timing must be recorded for the diagnostic.
  for (const fn of ['markAuthBootstrapStart', 'markAuthBootstrapSettled', 'markAuthBootstrapTimedOut']) {
    if (!new RegExp(`\\b${fn}\\b`).test(auth)) {
      fail(`auth: bootstrap must call ${fn}() for __authStartupHealth timing`);
    }
  }
  if (!FAILED.some((f) => f.includes('markAuthBootstrap'))) {
    pass('auth: bootstrap records start/settle/timeout timing');
  }
}

// ─── 2. __authStartupHealth diagnostic present ─────────────────
const rt = read('src/runtime/authStartup/AuthStartupHealthRuntime.ts');
if (!rt) {
  fail('diagnostics: src/runtime/authStartup/AuthStartupHealthRuntime.ts must exist');
} else {
  for (const tok of [
    '__authStartupHealth', 'authBootstrapStarted', 'authBootstrapSettled',
    'authBootstrapMs', 'timeoutMs', 'timedOut', 'recoveryRendered',
    'appShellAllowed',
  ]) {
    if (!new RegExp(`\\b${tok}\\b`).test(rt)) {
      fail(`diagnostics: AuthStartupHealthRuntime must surface "${tok}"`);
    }
  }
  if (!FAILED.some((f) => f.startsWith('diagnostics:'))) {
    pass('diagnostics: __authStartupHealth surfaces the full §3 envelope');
  }
}
const state = read('src/runtime/authStartup/authStartupState.js');
if (!/getAuthStartupSnapshot/.test(state)) {
  fail('diagnostics: authStartupState.js must export getAuthStartupSnapshot');
}

// ─── 3. Wired in App.jsx ───────────────────────────────────────
const app = read('src/App.jsx');
if (!/installAuthStartupHealthGlobal/.test(app)) {
  fail('wiring: App.jsx must wire installAuthStartupHealthGlobal');
} else {
  pass('wiring: App.jsx wires installAuthStartupHealthGlobal');
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:auth-startup-timeout] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:auth-startup-timeout] PASS — auth bootstrap has an 8s hard-stop, bounded repairs, observable timing.');
for (const p of PASSED) console.log('  ✓ ' + p);
