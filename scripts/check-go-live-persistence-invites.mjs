#!/usr/bin/env node
/**
 * scripts/check-go-live-persistence-invites.mjs — Wave-38 CI gate.
 *
 * Statically enforces the wave-38 production go-live contract:
 *   • PersistenceRuntime + InviteRuntime + OfflineValidationRuntime
 *     suites all exist with their barrels + diagnostic globals.
 *   • App.jsx boot wires all three installers.
 *   • Release lock surfaces all three readiness flags.
 *   • Invite runtime does NOT mark fake delivery (fakeDelivery
 *     field defaults to false and the contract enforces it).
 *   • PersistenceGuard exports requireWritablePersistence + uses
 *     SAFE_503_MESSAGE for all rejection envelopes.
 *   • GoLiveHealthRuntime composes persistence + invites + offline.
 *
 * Read-only.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
function fail(m) { FAILED.push(m); }
function pass(m) { PASSED.push(m); }

function read(file) {
  try { return fs.readFileSync(file, 'utf8'); }
  catch { return ''; }
}

const SUITE = [
  { dir: 'persistence', installer: 'installPersistenceGlobal',         global: '__persistenceHealth' },
  { dir: 'invites',     installer: 'installInviteGlobal',              global: '__inviteHealth' },
];

// 1. Per-suite barrel + installer + global.
for (const { dir, installer, global } of SUITE) {
  const barrel = read(path.join(ROOT, `src/runtime/${dir}/index.ts`));
  if (!barrel) { fail(`go-live: missing src/runtime/${dir}/index.ts`); continue; }
  if (!barrel.includes(installer)) {
    fail(`go-live: ${dir}/index.ts must re-export ${installer}`);
  }
  // Walk subtree to confirm the global is pinned.
  const files = (() => {
    try {
      return fs.readdirSync(path.join(ROOT, `src/runtime/${dir}`))
        .map((f) => path.join(ROOT, `src/runtime/${dir}`, f))
        .filter((p) => fs.statSync(p).isFile());
    } catch { return []; }
  })();
  const joined = files.map(read).join('\n');
  if (!joined.includes(global)) {
    fail(`go-live: ${dir} runtime must pin window.${global}`);
  }
}

// 2. OfflineValidationRuntime present (single-file suite).
const offlinePath = path.join(ROOT, 'src/runtime/offline/OfflineValidationRuntime.ts');
const offline = read(offlinePath);
if (!offline) {
  fail(`go-live: src/runtime/offline/OfflineValidationRuntime.ts missing`);
} else {
  if (!offline.includes('__offlineValidationHealth')) {
    fail(`go-live: OfflineValidationRuntime must pin window.__offlineValidationHealth`);
  }
  if (!offline.includes('installOfflineValidationGlobal')) {
    fail(`go-live: OfflineValidationRuntime must export installOfflineValidationGlobal`);
  }
}

// 3. App.jsx wires the three installers.
const app = read(path.join(ROOT, 'src/App.jsx'));
for (const installer of [
  'installPersistenceGlobal',
  'installInviteGlobal',
  'installOfflineValidationGlobal',
]) {
  if (!app.includes(installer)) {
    fail(`go-live: App.jsx must call ${installer}() during boot`);
  }
}

// 4. Release lock surfaces the three readiness flags.
const lock = read(path.join(ROOT, 'src/runtime/launchBlockers/index.ts'));
for (const f of ['persistenceProductionSafe', 'invitesActivationReady',
                  'offlineValidationReady']) {
  if (!lock.includes(f)) {
    fail(`go-live: launchBlockers/index.ts must surface ${f}`);
  }
}

// 5. PersistenceGuard contract.
const guard = read(path.join(ROOT, 'src/runtime/persistence/PersistenceGuard.ts'));
if (!guard.includes('requireWritablePersistence')) {
  fail(`go-live: PersistenceGuard must export requireWritablePersistence`);
}
if (!guard.includes('SAFE_503_MESSAGE')) {
  fail(`go-live: PersistenceGuard must use SAFE_503_MESSAGE for rejection envelopes`);
}

// 6. Invite runtime — no fake delivery.
const inviteRuntime = read(path.join(ROOT, 'src/runtime/invites/InviteRuntime.ts'));
if (!inviteRuntime.includes('fakeDelivery:             false')
    && !inviteRuntime.includes('fakeDelivery: false')) {
  fail(`go-live: InviteRuntime must declare fakeDelivery: false in inviteHealth`);
}
const emailProvider = read(path.join(ROOT, 'src/runtime/invites/EmailInviteProvider.ts'));
const smsProvider   = read(path.join(ROOT, 'src/runtime/invites/SMSInviteProvider.ts'));
// Providers must return ok:false when not configured.
if (!emailProvider.includes(`reason:       'no_provider'`)
    && !emailProvider.includes(`reason: 'no_provider'`)) {
  fail(`go-live: EmailInviteProvider must return reason:'no_provider' when unconfigured`);
}
if (!smsProvider.includes(`reason:       'no_provider'`)
    && !smsProvider.includes(`reason: 'no_provider'`)) {
  fail(`go-live: SMSInviteProvider must return reason:'no_provider' when unconfigured`);
}

// 7. Token must be hashed before storage — InviteRecord.tokenHash.
const inviteContracts = read(path.join(ROOT, 'src/runtime/invites/inviteContracts.ts'));
if (!inviteContracts.includes('tokenHash:')) {
  fail(`go-live: InviteRecord must include tokenHash field — NEVER store raw token`);
}

// 8. GoLiveHealthRuntime composes persistence + invites + offline.
const goLive = read(path.join(ROOT, 'src/runtime/launchBlockers/GoLiveHealthRuntime.ts'));
if (!goLive.includes('__persistenceHealth')
    || !goLive.includes('__inviteHealth')
    || !goLive.includes('__offlineValidationHealth')) {
  fail(`go-live: GoLiveHealthRuntime must compose persistence + invites + offline probes`);
}

if (FAILED.length === 0) {
  pass(`go-live: 3 runtimes wired · 3 globals · App boot · release lock · no fake delivery · token hashing · composite verdict`);
}

if (FAILED.length > 0) {
  console.error('[check:go-live-persistence-invites] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} checks passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:go-live-persistence-invites] PASS — wave-38 go-live contract intact.');
console.log(`  PersistenceRuntime · InviteRuntime · OfflineValidationRuntime wired`);
console.log(`  PersistenceGuard exports requireWritablePersistence + SAFE_503_MESSAGE`);
console.log(`  No fake invite delivery · tokens hashed before storage · GoLive composite verdict`);
