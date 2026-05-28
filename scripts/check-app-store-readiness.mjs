#!/usr/bin/env node
/**
 * check-app-store-readiness.mjs — wave 8 CI ratchet.
 *
 *   node scripts/check-app-store-readiness.mjs
 *
 * What this verifies
 * ──────────────────
 *   1. All wave-8 runtime modules exist with the spec'd exports.
 *   2. classifierAvailability exposes the 5 required snapshot fields:
 *        realClassifierAvailable, classifierExecuted, fallbackUsed,
 *        imageValidated, resultValid
 *   3. notificationRuntime declares all 5 spec'd NOTIFICATION_KIND
 *      values: TASK_DUE, FOLLOWUP_SCAN, WEATHER_RISK,
 *      UNRESOLVED_ISSUE, QUEUE_SYNCED
 *   4. appStoreSafetyMode declares overrides for the 6 transactional
 *      flags: buyMarketplace, marketTransactionFlow, marketScale,
 *      marketRevenueScale, multiMarket, smartFundingRecommendations
 *   5. languageCoverageRuntime declares all 6 supported locales:
 *      en, fr, sw, ha, tw, hi
 *   6. All 5 wave-8 diagnostics wired:
 *      __appStoreReadiness, __notificationHealth, __featureFlags,
 *      __farrowayBuild, __scanRuntimeHealthV8
 *   7. App.jsx invokes installAppStoreReadinessRuntime() during boot.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const HEADER    = '[check:app-store-readiness]';

function _read(rel) {
  const p = resolve(ROOT, rel);
  if (!existsSync(p)) return null;
  try { return readFileSync(p, 'utf8'); } catch { return null; }
}

function fail(message, details) {
  console.error(HEADER, 'FAIL — ' + message);
  if (details) console.error('  ' + details);
  process.exit(1);
}

const FILES = {
  classifier:   'src/runtime/scan/classifierAvailability.js',
  notification: 'src/runtime/notifications/notificationRuntime.js',
  safety:       'src/runtime/appStore/appStoreSafetyMode.js',
  readiness:    'src/runtime/appStore/appStoreReadinessRuntime.js',
  language:     'src/runtime/language/languageCoverageRuntime.js',
  diagnostics:  'src/lib/weatherAndLanguageDiagnostics.js',
  app:          'src/App.jsx',
};

const sources = {};
for (const [k, rel] of Object.entries(FILES)) {
  const src = _read(rel);
  if (!src) fail('missing required file: ' + rel);
  sources[k] = src;
}

// 1) Classifier exposes 5 snapshot fields
const CLASSIFIER_FIELDS = [
  'realClassifierAvailable', 'classifierExecuted',
  'fallbackUsed', 'imageValidated', 'resultValid',
];
for (const f of CLASSIFIER_FIELDS) {
  if (!new RegExp(f + '\\s*:').test(sources.classifier)) {
    fail('classifierAvailability snapshot missing field: ' + f);
  }
}

// 2) NOTIFICATION_KIND values
const NOTIF_KINDS = [
  'TASK_DUE', 'FOLLOWUP_SCAN', 'WEATHER_RISK',
  'UNRESOLVED_ISSUE', 'QUEUE_SYNCED',
];
const kindBlock = sources.notification.match(
  /NOTIFICATION_KIND\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\)/);
if (!kindBlock) fail('NOTIFICATION_KIND block missing');
for (const k of NOTIF_KINDS) {
  if (!new RegExp(k + '\\s*:').test(kindBlock[1])) {
    fail('NOTIFICATION_KIND missing: ' + k);
  }
}

// 3) Safety mode declares 6 overrides
const SAFE_OVERRIDES = [
  'buyMarketplace', 'marketTransactionFlow', 'marketScale',
  'marketRevenueScale', 'multiMarket', 'smartFundingRecommendations',
];
const safeBlock = sources.safety.match(
  /APP_STORE_SAFE_DEFAULTS\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\)/);
if (!safeBlock) fail('APP_STORE_SAFE_DEFAULTS block missing');
for (const o of SAFE_OVERRIDES) {
  if (!new RegExp(o + '\\s*:\\s*false').test(safeBlock[1])) {
    fail('APP_STORE_SAFE_DEFAULTS missing override: ' + o + ' (must be false)');
  }
}

// 4) Language runtime declares 6 locales
const LOCALES = ['en', 'fr', 'sw', 'ha', 'tw', 'hi'];
const localesBlock = sources.language.match(
  /SUPPORTED_LOCALES\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/);
if (!localesBlock) fail('SUPPORTED_LOCALES array missing in language runtime');
for (const l of LOCALES) {
  if (!new RegExp("['\"]" + l + "['\"]").test(localesBlock[1])) {
    fail('SUPPORTED_LOCALES missing locale: ' + l);
  }
}

// 5) Diagnostics wired
const DIAGS = [
  '__appStoreReadiness', '__notificationHealth',
  '__featureFlags', '__farrowayBuild', '__scanRuntimeHealthV8',
];
for (const d of DIAGS) {
  if (!new RegExp('window\\.' + d + '\\s*=').test(sources.diagnostics)) {
    fail('diagnostic ' + d + ' not wired');
  }
}

// 6) App.jsx wires install
if (!/installAppStoreReadinessRuntime\s*\(\s*\)/.test(sources.app)) {
  fail('App.jsx does not call installAppStoreReadinessRuntime() during boot');
}

// 7) Readiness runtime exports the verdict function
const READINESS_EXPORTS = [
  'installAppStoreReadinessRuntime', 'getAppStoreReadiness',
  'getFarrowayBuild',
];
for (const sym of READINESS_EXPORTS) {
  if (!new RegExp('export\\s+(function|const|async function)\\s+' + sym + '\\b')
        .test(sources.readiness)) {
    fail('appStoreReadinessRuntime missing export: ' + sym);
  }
}

console.log(HEADER, 'PASS — wave 8 App Store readiness complete.');
console.log('  ' + CLASSIFIER_FIELDS.length + ' classifier honesty fields, '
  + NOTIF_KINDS.length + ' notification kinds, '
  + SAFE_OVERRIDES.length + ' safety overrides, '
  + LOCALES.length + ' locales, '
  + DIAGS.length + ' diagnostics wired.');
process.exit(0);
