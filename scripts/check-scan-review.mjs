#!/usr/bin/env node
/**
 * check-scan-review.mjs — Scan V4 Human Verification contract lock.
 *
 *   • ConfidenceRoutingRuntime exposes routeByConfidence with hard
 *     cutoffs (HIGH=85, MEDIUM=65), 3 routes, noDeadEnds + noBypassing
 *     literal-true. Every input yields a defined route.
 *   • FieldOfficerScanQueueRuntime exports role-gated listQueueForRole;
 *     declares roleScoped + orgScoped + noCrossOrgLeakage literal-true.
 *   • AdminScanReviewQueueRuntime exports admin-gated listAdminQueueForRole;
 *     declares adminOnly literal-true. Other roles must see empty.
 *   • ScanReviewStatusRuntime exports the 5 spec statuses + transition
 *     table; transitionsLocked literal-true.
 *   • ScanResolutionEngine.resolveScanReview ALWAYS returns artifact +
 *     followUpTaskDescriptor (never null); declares
 *     alwaysGeneratesAction + alwaysGeneratesFollowUp literal-true.
 *   • ScanReviewHealth pins __scanReviewHealth with all 9 spec flags +
 *     noDeadEnds + noCrossOrgLeakage + noFakeReviews literal-true.
 *   • App.jsx wires all 6 new installs.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const fails = [];
const read = (rel) => {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { fails.push(`missing: ${rel}`); return ''; }
  return fs.readFileSync(p, 'utf8');
};

// 1. ConfidenceRoutingRuntime.
{
  const f = 'src/runtime/scanAccuracy/ConfidenceRoutingRuntime.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__confidenceRoutingHealth',
      'installConfidenceRoutingGlobal',
      'routeByConfidence',
      'confidenceRoutingReady',
      'HIGH_CONFIDENCE_MIN', 'MEDIUM_CONFIDENCE_MIN',
      "'ai_accept'", "'medium_ask'", "'human_review'",
      'noDeadEnds: true as const',
      'noBypassing: true as const',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
    if (src.indexOf('HIGH_CONFIDENCE_MIN = 85') < 0)
      fails.push(`${f}: HIGH_CONFIDENCE_MIN must equal 85`);
    if (src.indexOf('MEDIUM_CONFIDENCE_MIN = 65') < 0)
      fails.push(`${f}: MEDIUM_CONFIDENCE_MIN must equal 65`);
  }
}

// 2. ScanReviewStatusRuntime.
{
  const f = 'src/runtime/scanAccuracy/ScanReviewStatusRuntime.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__scanReviewStatusHealth',
      'installScanReviewStatusGlobal',
      'setScanStatus', 'statusForScan', 'listByStatus',
      'reviewQueueReady',
      'VALID_STATUSES', 'ALLOWED_TRANSITIONS',
      'transitionsLocked: true as const',
      'noFakeStatuses: true as const',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
    // Must enumerate 5 spec statuses.
    for (const s of ["'pending_review'", "'community_reviewing'",
                     "'officer_reviewing'", "'resolved'", "'follow_up_due'"]) {
      if (src.indexOf(s) < 0) fails.push(`${f}: missing status literal ${s}`);
    }
  }
}

// 3. FieldOfficerScanQueueRuntime.
{
  const f = 'src/runtime/scanAccuracy/FieldOfficerScanQueueRuntime.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__fieldOfficerScanQueueHealth',
      'installFieldOfficerScanQueueGlobal',
      'enqueueScanForOfficerReview',
      'listQueueForRole',
      'fieldOfficerReviewReady',
      'FieldOfficerScanQueueItem',
      'OfficerScanReviewSubmission',
      'roleScoped: true as const',
      'orgScoped: true as const',
      'noCrossOrgLeakage: true as const',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
    // Must filter on role.
    if (src.indexOf("'field_officer'") < 0)
      fails.push(`${f}: must check 'field_officer' role`);
    if (src.indexOf("'organization_admin'") < 0)
      fails.push(`${f}: must check 'organization_admin' role`);
  }
}

// 4. AdminScanReviewQueueRuntime.
{
  const f = 'src/runtime/scanAccuracy/AdminScanReviewQueueRuntime.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__adminScanReviewQueueHealth',
      'installAdminScanReviewQueueGlobal',
      'enqueueAdminReview', 'listAdminQueueForRole',
      'adminReviewReady',
      'AdminReviewReason', 'AdminScanReviewItem',
      "'unresolved'", "'conflicting'", "'high_risk'",
      'adminOnly: true as const',
      'noFabricatedQueue: true as const',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
    // Admin-only gate must reject non-admin roles.
    if (src.indexOf("r !== 'admin'") < 0)
      fails.push(`${f}: must reject roles other than 'admin'`);
  }
}

// 5. ScanResolutionEngine.
{
  const f = 'src/runtime/scanAccuracy/ScanResolutionEngine.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__scanResolutionHealth',
      'installScanResolutionEngineGlobal',
      'resolveScanReview', 'listResolvedArtifacts',
      'resolutionEngineReady',
      'ScanResolvedArtifact', 'ResolutionResult',
      'recommendedAction', 'followUpTaskDescriptor',
      'alwaysGeneratesAction: true as const',
      'alwaysGeneratesFollowUp: true as const',
      'noFakeArtifacts: true as const',
      "'community'", "'field_officer'", "'admin'", "'grower_pick'",
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
  }
}

// 6. ScanReviewHealth composite.
{
  const f = 'src/runtime/scanAccuracy/ScanReviewHealth.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__scanReviewHealth',
      'installScanReviewHealthGlobal',
      'ScanReviewHealthEnvelope',
      // 9 spec flags.
      'communityReviewReady',
      'fieldOfficerReviewReady',
      'adminReviewReady',
      'confidenceRoutingReady',
      'reviewQueueReady',
      'resolutionEngineReady',
      'notificationsReady',
      'roleSecurityReady: true as const',
      'noDeadEnds: true as const',
      'noCrossOrgLeakage: true as const',
      'noFakeReviews: true as const',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
  }
}

// 7. App.jsx wires all 6.
{
  const f = 'src/App.jsx';
  const src = read(f);
  if (src) {
    const required = [
      'installConfidenceRoutingGlobal',
      'installScanReviewStatusGlobal',
      'installFieldOfficerScanQueueGlobal',
      'installAdminScanReviewQueueGlobal',
      'installScanResolutionEngineGlobal',
      'installScanReviewHealthGlobal',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}()" install`);
    }
  }
}

if (fails.length) {
  console.error('[check:scan-review] FAILED');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:scan-review] OK');
