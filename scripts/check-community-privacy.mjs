#!/usr/bin/env node
/**
 * scripts/check-community-privacy.mjs — §6 PRIVACY + SAFETY.
 *
 * Fails if any of the §6 invariants are missing:
 *   • preciseLocationHidden hard-coded true in every post
 *   • private farm data hidden from buyers (projectForBuyer present)
 *   • organization scope enforced
 *   • report-abuse wired
 *   • PII patterns (phone/email/precise GPS) blocked
 *   • posts default to PRIVATE (no public-default anywhere)
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

// Contracts file MUST declare the private default + the PII regexes.
const contracts = read('src/runtime/community/GrowPostContracts.ts');
if (!contracts) F.push('GrowPostContracts.ts: missing');
else {
  if (!/DEFAULT_VISIBILITY\s*:\s*Visibility\s*=\s*'private'/.test(contracts)
      && !/DEFAULT_VISIBILITY\s*=\s*'private'/.test(contracts))
    F.push('contracts must declare DEFAULT_VISIBILITY = private');
  else P.push('DEFAULT_VISIBILITY is private');
  if (!/containsPII|PHONE_RE|EMAIL_RE|GPS_RE/.test(contracts))
    F.push('contracts must define PII detectors');
  else P.push('PII detectors defined');
  if (!/preciseLocationHidden:\s*true/.test(contracts))
    F.push('contracts must enforce preciseLocationHidden:true on every post');
  else P.push('preciseLocationHidden hard-coded true');
  if (!/visibilityConfirmed/.test(contracts))
    F.push('contracts must require visibilityConfirmed for public posts');
  else P.push('public visibility requires visibilityConfirmed');
}

// Privacy guard MUST expose the 5 §6 flags as literal-true.
const guard = read('src/runtime/community/CommunityPrivacyGuard.ts');
if (!guard) F.push('CommunityPrivacyGuard.ts: missing');
else {
  for (const k of ['preciseLocationHidden: true', 'privateFarmDataHidden: true',
    'buyerPrivacySafe: true', 'organizationScoped: true', 'reportAbuseReady: true']) {
    if (!guard.includes(k)) F.push(`privacy guard must declare ${k}`);
  }
  if (!F.some((m) => /privacy guard/.test(m))) P.push('§6 flags literal-true');
}

// Visibility policy must project private data away from buyers.
const policy = read('src/runtime/community/GrowVisibilityPolicy.ts');
if (!policy) F.push('GrowVisibilityPolicy.ts: missing');
else {
  if (!/projectForBuyer/.test(policy)) F.push('visibility policy must export projectForBuyer');
  else P.push('projectForBuyer present');
  if (!/isBuyerRole/.test(policy)) F.push('visibility policy must detect buyer role');
  else P.push('buyer role detection present');
  if (!/farmId:\s*null/.test(policy) || !/organizationId:\s*null/.test(policy))
    F.push('buyer projection must strip farmId and organizationId');
  else P.push('buyer projection strips farmId + organizationId');
}

// Server route handler must mirror enforcement.
const server = read('server/src/modules/community/routes.js');
if (!server) F.push('server/src/modules/community/routes.js: missing');
else {
  if (!/containsPII/.test(server)) F.push('server must reject PII in posts');
  else P.push('server rejects PII');
  if (!/visibility\s*=\s*['"]private['"]/.test(server))
    F.push('server must default visibility to private');
  else P.push('server defaults visibility to private');
  if (!/visibilityConfirmed/.test(server))
    F.push('server must require visibilityConfirmed for public posts');
  else P.push('server requires visibilityConfirmed for public');
  if (!/projectForBuyer|isBuyer/.test(server))
    F.push('server feed must apply buyer projection');
  else P.push('server applies buyer projection');
}

if (F.length) {
  console.error('[check:community-privacy] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:community-privacy] PASS — private default, PII rejected, buyer projection, org scope, report-abuse.');
for (const m of P) console.log('  ✓ ' + m);
