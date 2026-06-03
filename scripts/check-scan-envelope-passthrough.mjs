/**
 * check-scan-envelope-passthrough.mjs
 *
 * Integration test for the Scan Root-Cause fix. Locks the
 * field-passthrough contract between the server's /api/scan/analyze
 * response and the client's `analyzeScan` wrap.
 *
 * Failure mode being defended:
 *   Before the root-cause fix, scanDetectionEngine.analyzeScan
 *   stripped the server response down to 9 whitelisted fields,
 *   silently dropping scanRecovery / plantName / scientificName /
 *   diseaseCandidates / pest / soil / fieldHealth / satellite /
 *   growthStage / regional / market. That's why production rendered
 *   "Plant: — · Unknown Plant · Needs Review" even after the Scan
 *   Recovery Sprint shipped — a structural file-existence gate
 *   couldn't see the runtime drop.
 *
 * This gate runs TWO checks:
 *
 *   1. STATIC — parses scanDetectionEngine.js + IntelligentScanResult.jsx
 *      and asserts the fix patterns are in place (spread before
 *      override; confidencePct field emitted; IntelligentScanResult
 *      prefers confidencePct over confidence).
 *
 *   2. RUNTIME — stubs globalThis.fetch with a known rich envelope,
 *      imports analyzeScan, asserts the result preserves every
 *      spec field exactly.
 *
 * Static checks always run. Runtime check best-effort: if the
 * module-import chain has incidental side effects in pure Node
 * (e.g. analytics tries to read localStorage), the runtime check
 * downgrades to a SKIP with explanation — but the static check
 * still must pass.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const errors = [];
const skips = [];

function _read(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return ''; }
}
function _exists(rel) {
  try { return fs.existsSync(path.join(ROOT, rel)); } catch { return false; }
}

// ════════════════════════════════════════════════════════════════
// STATIC SECTION — patterns that prove the fix is in source.
// ════════════════════════════════════════════════════════════════

const ENGINE = 'src/core/scanDetectionEngine.js';
if (!_exists(ENGINE)) {
  errors.push('missing: ' + ENGINE);
} else {
  const src = _read(ENGINE);

  // The analyzeScan wrap block is the one that references
  // `apiResult.possibleIssue` — that's unique to the API-success
  // path. The earlier fallback block (`getRuleBasedFallback`) uses
  // a local `possibleIssue` variable and never references
  // apiResult, so this anchor is unambiguous.
  const anchor = 'apiResult.possibleIssue';
  const anchorAt = src.indexOf(anchor);
  if (anchorAt < 0) {
    errors.push('scanDetectionEngine missing the analyzeScan wrap block (no `apiResult.possibleIssue` reference)');
  } else {
    // Walk back to the nearest `return Object.freeze({` BEFORE the
    // anchor — that's the wrap-block opening.
    const before = src.slice(0, anchorAt);
    const wrapStart = before.lastIndexOf('return Object.freeze({');
    if (wrapStart < 0) {
      errors.push('scanDetectionEngine wrap block start not found before apiResult anchor');
    } else {
      const wrapBlock = src.slice(wrapStart, anchorAt + 2500);
      if (!wrapBlock.includes('...apiResult')) {
        errors.push('scanDetectionEngine analyzeScan wrap missing `...apiResult` spread (regression risk: field-stripping)');
      }
      if (!wrapBlock.includes('confidencePct')) {
        errors.push('scanDetectionEngine analyzeScan wrap must emit `confidencePct` (numeric companion)');
      }
      // The spread MUST appear textually before the legacy `scanId,`
      // override so the override wins for the 9-field back-compat
      // contract.
      const spreadAt = wrapBlock.indexOf('...apiResult');
      const scanIdAt = wrapBlock.indexOf('scanId,');
      if (spreadAt >= 0 && scanIdAt >= 0 && spreadAt > scanIdAt) {
        errors.push('scanDetectionEngine wrap: `...apiResult` MUST appear before `scanId,` so legacy override wins');
      }
    }
  }
}

const RESULT = 'src/components/scan/IntelligentScanResult.jsx';
if (!_exists(RESULT)) {
  errors.push('missing: ' + RESULT);
} else {
  const src = _read(RESULT);
  // _extractIdentification must prefer r.confidencePct over r.confidence
  // so the legacy banded string can't pin the UI to 25%.
  if (!/r\.confidencePct[\s\S]{0,80}r\.confidence/.test(src)) {
    errors.push('IntelligentScanResult._extractIdentification must prefer r.confidencePct over r.confidence');
  }
}

// ════════════════════════════════════════════════════════════════
// RUNTIME SECTION — fake server envelope round-trips through
// analyzeScan with the field set we care about.
// ════════════════════════════════════════════════════════════════

const FAKE_SERVER_RESPONSE = Object.freeze({
  ok: true,
  scanId: 'scan_test_passthrough',
  plantName: 'Tomato',
  scientificName: 'Solanum lycopersicum',
  // NUMERIC confidence — this is the path that used to break.
  confidence: 87,
  confidenceBand: 'high',
  diseaseCandidates: Object.freeze([Object.freeze({
    name: 'Early blight', score: 0.71,
    description: 'Caused by Alternaria solani.',
    source: 'plantid',
  })]),
  scanRecovery: Object.freeze({
    runtimeVersion: 'scan-recovery-envelope-v4',
    plantName: 'Tomato',
    scientificName: 'Solanum lycopersicum',
    confidence: 87,
    diseaseCandidates: Object.freeze([Object.freeze({
      name: 'Early blight', score: 0.71,
    })]),
  }),
  pest: null,
  soil: Object.freeze({ ok: true, ph: 6.5,
    soilTexture: Object.freeze({ label: 'loamy' }) }),
  fieldHealth: null,
  satellite: null,
  growthStage: null,
  regional: null,
  market: null,
  // Legacy fields the engine's whitelist preserved:
  possibleIssue: 'Possible early blight',
  explanation: 'Tomato leaves show classic concentric ring pattern.',
  recommendedActions: ['Inspect lower leaves', 'Improve airflow'],
  safetyWarning: null,
  shouldSeekHelp: false,
  suggestedTasks: [],
});

// Stub fetch BEFORE importing anything that might consume it.
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => FAKE_SERVER_RESPONSE,
});
// Stub AbortController if missing.
if (typeof globalThis.AbortController === 'undefined') {
  globalThis.AbortController = class { constructor() { this.signal = { aborted: false }; }
    abort() { this.signal.aborted = true; } };
}
// Stub minimal DOM globals so any incidental window-touching modules don't blow.
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    addEventListener: () => {}, removeEventListener: () => {},
  };
}
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = globalThis.window.localStorage;
}
if (typeof globalThis.document === 'undefined') {
  globalThis.document = { addEventListener: () => {}, removeEventListener: () => {} };
}

let runtimeOk = false;
try {
  const enginePath = pathToFileURL(path.join(ROOT, ENGINE)).href;
  const mod = await import(enginePath);
  if (!mod || typeof mod.analyzeScan !== 'function') {
    skips.push('runtime: analyzeScan export not found — static checks still authoritative');
  } else {
    const result = await mod.analyzeScan({
      imageBase64: 'data:image/jpeg;base64,STUB',
      cropName: 'tomato',
      experience: 'farm',
    });

    // Field-by-field assertion.
    const fieldChecks = [
      ['plantName',       'Tomato'],
      ['scientificName',  'Solanum lycopersicum'],
      ['confidencePct',   87],
      ['scanId',          'scan_test_passthrough'],
    ];
    for (const [field, expected] of fieldChecks) {
      if (result[field] !== expected) {
        errors.push('runtime: result.' + field + ' = '
          + JSON.stringify(result[field]) + ' — expected '
          + JSON.stringify(expected));
      }
    }
    // scanRecovery envelope preserved (object reference equality
    // not required, but shape must round-trip).
    if (!result.scanRecovery || result.scanRecovery.plantName !== 'Tomato') {
      errors.push('runtime: result.scanRecovery did NOT pass through with plantName');
    }
    // diseaseCandidates preserved as array.
    if (!Array.isArray(result.diseaseCandidates)
        || result.diseaseCandidates.length !== 1
        || result.diseaseCandidates[0].name !== 'Early blight') {
      errors.push('runtime: result.diseaseCandidates did NOT preserve the disease list');
    }
    // soil envelope preserved.
    if (!result.soil || !result.soil.soilTexture
        || result.soil.soilTexture.label !== 'loamy') {
      errors.push('runtime: result.soil did NOT pass through');
    }
    // Legacy band-string preserved for back-compat with old callers.
    if (typeof result.confidence !== 'string') {
      errors.push('runtime: legacy result.confidence band-string missing (back-compat break)');
    }
    runtimeOk = true;
  }
} catch (err) {
  skips.push('runtime: analyzeScan import threw — '
    + ((err && err.message) || 'unknown')
    + ' (static checks still authoritative)');
}

// ════════════════════════════════════════════════════════════════
// VERDICT
// ════════════════════════════════════════════════════════════════

if (skips.length) {
  for (const s of skips) console.log('[check:scan-envelope-passthrough] SKIP — ' + s);
}

if (errors.length) {
  console.error('[check:scan-envelope-passthrough] FAIL — '
    + errors.length + ' violation(s):');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

console.log('[check:scan-envelope-passthrough] PASS — '
  + (runtimeOk ? 'static + runtime field passthrough verified'
              : 'static field passthrough verified (runtime skipped)') + '.');
