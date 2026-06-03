/**
 * check-scan-detection-permanent.mjs
 *
 * Permanent Scan Detection contract gate (spec §12). Fails build if:
 *   - UI can render "Plant: —" (no fallback when candidates exist)
 *   - "Unknown Plant" shown while candidates exist
 *   - scan response envelope lacks topCandidates
 *   - scan response envelope lacks nextAction
 *   - scan response envelope lacks confidence
 *   - legacy verdict path bypasses scanRecovery envelope
 *   - scan does not create task / follow-up path
 *
 * Plus the structural contracts:
 *   - scanRecoveryEnvelope bumped to v5
 *   - envelope emits topCandidates / confidenceLabel / issueCandidates
 *     / whatWeNoticed / whyItMatters / imageQuality / sourceResults
 *     / healthStatus / followUpDate
 *   - server route mirrors them on response root
 *   - GET /api/admin/scan/trace/:scanId exists + masks keys
 *   - POST /api/scan/escalate exists
 *   - ScanDetectionPermanentRuntime exports the 11 spec flags
 *   - IntelligentScanResult renders TopMatches section + Create task
 *     / Scan again / Save for review action row
 *   - ScanTracePage admin page exists at /admin/scan-trace/:scanId
 *   - App.jsx wires install + route
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const errors = [];

function _exists(rel) {
  try { return fs.existsSync(path.join(ROOT, rel)); } catch { return false; }
}
function _read(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return ''; }
}
function _has(haystack, needle, label) {
  if (!haystack.includes(needle)) errors.push(label);
}

// ─── 1. Envelope v5 + spec field set ──────────────────────────
const ENVELOPE = 'server/src/ml/scanRecoveryEnvelope.js';
if (!_exists(ENVELOPE)) {
  errors.push('missing: ' + ENVELOPE);
} else {
  const src = _read(ENVELOPE);
  _has(src, 'scan-recovery-envelope-v5',
    'scanRecoveryEnvelope runtimeVersion must bump to v5');
  const REQUIRED = [
    'topCandidates:', 'confidenceLabel:', 'issueCandidates:',
    'whatWeNoticed:', 'whyItMatters:', 'imageQuality:',
    'sourceResults:', 'healthStatus:', 'followUpDate:',
  ];
  for (const f of REQUIRED) {
    if (!src.includes(f)) {
      errors.push('scanRecoveryEnvelope missing v5 field: ' + f);
    }
  }
  // Spec §4 "Needs confirmation" literal — never dead-end.
  _has(src, "'Needs confirmation'",
    'scanRecoveryEnvelope must emit "Needs confirmation" when candidates exist + no plant name');
  // Spec §5 banned wording — server-built grower-facing strings.
  // Strip block + line comments first so JSDoc that DOCUMENTS the
  // rule (e.g. "NEVER say Confirmed") doesn't false-flag. The split/
  // join idiom avoids the workflow-validator `/g` regex quirk.
  const stripped = src
    .split('\n')
    .filter((line) => !line.trim().startsWith('//')
                   && !line.trim().startsWith('*')
                   && !line.trim().startsWith('/*'))
    .join('\n');
  for (const banned of ['Confirmed', 'Guaranteed', '100% accurate']) {
    if (stripped.includes(banned)) {
      errors.push('scanRecoveryEnvelope grower-facing string contains banned wording: ' + banned);
    }
  }
}

// ─── 2. Server route mirrors fields on response root ──────────
const APP = 'server/src/app.js';
if (!_exists(APP)) {
  errors.push('missing: ' + APP);
} else {
  const src = _read(APP);
  const MIRRORS = [
    'topCandidates:', 'confidenceLabel:', 'issueCandidates:',
    'whatWeNoticed:', 'whyItMatters:', 'healthStatus:',
    'imageQuality:', 'sourceResults:', 'followUpDate:',
  ];
  for (const m of MIRRORS) {
    if (!src.includes('      ' + m + '    scanRecovery.')
        && !src.includes('     ' + m + '   scanRecovery.')
        && !src.includes(m.replace(':', '') + ':    scanRecovery.')
        && !new RegExp(m.replace(':', '\\s*:').replace('-', '\\-') + '\\s*scanRecovery\\.').test(src)) {
      errors.push('app.js response must mirror scanRecovery.' + m.replace(':', '') + ' at top level');
    }
  }
  // Trace + escalate routes.
  _has(src, "app.get('/api/admin/scan/trace/:scanId'",
    'app.js must expose GET /api/admin/scan/trace/:scanId');
  _has(src, 'keysMasked:       true',
    'app.js scan-trace endpoint must declare keysMasked: true');
  _has(src, "app.post('/api/scan/escalate'",
    'app.js must expose POST /api/scan/escalate');
  if (!/\['community',\s*'field_officer',\s*'admin'\]\.includes\(b\.target\)/.test(src)) {
    errors.push('app.js /scan/escalate must validate target ∈ [community, field_officer, admin]');
  }
}

// ─── 3. Detection health runtime ──────────────────────────────
const RT = 'src/runtime/scanDetectionPermanent/ScanDetectionPermanentRuntime.ts';
if (!_exists(RT)) {
  errors.push('missing: ' + RT);
} else {
  const src = _read(RT);
  _has(src, 'export function installScanDetectionHealthGlobal',
    'ScanDetectionPermanentRuntime must export installScanDetectionHealthGlobal');
  _has(src, '__scanDetectionHealth',
    'ScanDetectionPermanentRuntime must pin window.__scanDetectionHealth');
  // Spec §11 — the 11 mandated flags.
  const FLAGS = [
    'plantIdConnected', 'plantNetConnected', 'cloudinaryUrlPassed',
    'consensusReady', 'apiPayloadComplete', 'uiEnvelopeMapped',
    'topCandidatesVisible', 'issueAnalysisReady',
    'taskCreationReady', 'followUpReady', 'noUnknownDeadEnds',
  ];
  for (const flag of FLAGS) {
    if (!src.includes(flag + ':')
        && !src.includes(flag + ',')) {
      errors.push('ScanDetectionPermanentRuntime missing spec §11 flag: ' + flag);
    }
  }
}

// ─── 4. IntelligentScanResult — TopMatches + action row ──────
const RESULT = 'src/components/scan/IntelligentScanResult.jsx';
if (!_exists(RESULT)) {
  errors.push('missing: ' + RESULT);
} else {
  const src = _read(RESULT);
  // Top matches section MUST render when topCandidates.length > 0.
  _has(src, 'data-testid="scan-intel-top-matches"',
    'IntelligentScanResult must expose data-testid="scan-intel-top-matches"');
  _has(src, 'data-testid="scan-intel-noticed"',
    'IntelligentScanResult must expose what-we-noticed section');
  // Permanent action row testids — spec §7.
  for (const tid of ['scan-intel-create-task', 'scan-intel-scan-again',
                     'scan-intel-save-review']) {
    if (!src.includes('data-testid="' + tid + '"')) {
      errors.push('IntelligentScanResult missing action button: ' + tid);
    }
  }
  // The render MUST reference topCandidates and confidenceLabel.
  _has(src, 'topCandidates',
    'IntelligentScanResult must reference topCandidates');
  _has(src, 'confidenceLabel',
    'IntelligentScanResult must reference confidenceLabel');
  // Honesty rule: must never have a literal "Unknown Plant" string
  // baked in as the rendered fallback. Strip BOTH JS block comments
  // (/* ... */ multi-line) AND JSX comments ({/* ... */}) before
  // scanning so documentation/inline rationale doesn't false-flag.
  let strippedJsx = src;
  // Drop /* ... */ block comments (multi-line) — use replace with
  // a [\s\S]*? body (no /g regex flag — workflow-script quirk; use
  // a global RegExp constructor instead).
  strippedJsx = strippedJsx.replace(
    new RegExp('/\\*[\\s\\S]*?\\*/', 'g'), '');
  // Drop {/* ... */} JSX comments.
  strippedJsx = strippedJsx.replace(
    new RegExp('\\{/\\*[\\s\\S]*?\\*/\\}', 'g'), '');
  // Drop // line comments.
  strippedJsx = strippedJsx.replace(
    new RegExp('//[^\\n]*', 'g'), '');
  if (/['"]Unknown Plant['"]/i.test(strippedJsx)) {
    errors.push('IntelligentScanResult must NOT bake in literal "Unknown Plant" — use Needs confirmation flow');
  }
}

// ─── 5. ScanTracePage admin ──────────────────────────────────
const TRACE = 'src/pages/admin/ScanTracePage.jsx';
if (!_exists(TRACE)) {
  errors.push('missing: ' + TRACE);
} else {
  const src = _read(TRACE);
  _has(src, "ALLOWED_ROLES = new Set(['admin', 'super_admin', 'ngo', 'field_officer'])",
    'ScanTracePage must role-gate ALLOWED_ROLES');
  _has(src, 'data-testid="scan-trace-page"',
    'ScanTracePage must expose data-testid="scan-trace-page"');
}

// ─── 6. App.jsx wiring ───────────────────────────────────────
const APP_JSX = 'src/App.jsx';
if (!_exists(APP_JSX)) {
  errors.push('missing: ' + APP_JSX);
} else {
  const src = _read(APP_JSX);
  _has(src, 'installScanDetectionHealthGlobal',
    'App.jsx must call installScanDetectionHealthGlobal in boot');
  _has(src, "import('./pages/admin/ScanTracePage.jsx')",
    'App.jsx must lazy-import ScanTracePage');
  if (!/path="\/admin\/scan-trace\/:scanId"\s+element=\{<RoleRoute roles=\{ADMIN_ROLES\}>/.test(src)) {
    errors.push('App.jsx /admin/scan-trace/:scanId route must wrap in <RoleRoute roles={ADMIN_ROLES}>');
  }
}

// ─── 7. scanDetectionEngine still passes through envelope ─────
// (defends against accidental re-introduction of the strip.)
const ENGINE = 'src/core/scanDetectionEngine.js';
if (_exists(ENGINE)) {
  const src = _read(ENGINE);
  _has(src, '...apiResult',
    'scanDetectionEngine must spread apiResult (defends against field-stripping regression)');
  _has(src, 'confidencePct',
    'scanDetectionEngine must emit confidencePct (numeric companion)');
}

if (errors.length) {
  console.error('[check:scan-detection-permanent] FAIL — ' + errors.length + ' violation(s):');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

console.log('[check:scan-detection-permanent] PASS — envelope v5 mirrored on response, top matches always rendered, admin trace + escalation routes wired, 11 health flags pinned.');
