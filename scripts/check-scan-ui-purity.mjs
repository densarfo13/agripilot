#!/usr/bin/env node
/**
 * check-scan-ui-purity.mjs — CI ratchet for the
 * "Scan UI components are pure ScanRuntime subscribers" contract.
 *
 *   node scripts/check-scan-ui-purity.mjs
 *
 * What this is
 * ────────────
 *   The canonical ScanRuntime (src/core/scan/ScanRuntime.js) is the
 *   ONLY authority that should own scan-image / scan-preview / scan-
 *   result / scan-confidence state. The visible UI surfaces consume
 *   the runtime via `useScanRuntime` and should NOT own duplicate
 *   state themselves.
 *
 *   This audit scans each tracked surface for forbidden useState
 *   patterns and compares against a baseline. The migration is
 *   ratcheted — current violations are grandfathered, new ones fail
 *   the build. As surfaces are migrated, the baseline shrinks.
 *
 *   Baseline file: `scripts/.scan-ui-purity-baseline.json`
 *
 *   If you ADD a new useState(previewUrl)-style ownership in a
 *   tracked file, this check fails. If you REMOVE one (migrating
 *   the surface to useScanRuntime), the baseline is auto-tightened
 *   when you run `node scripts/check-scan-ui-purity.mjs --tighten`.
 *
 *   Tracked surfaces (engine-layer scan UI):
 *     • src/components/scan/LiveCameraScanner.jsx
 *     • src/pages/ScanPage.jsx
 *
 *   ScanCapture.jsx was migrated in the same commit as this script
 *   and is no longer tracked — it now subscribes to useScanRuntime.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const BASELINE_PATH = resolve(__dirname, '.scan-ui-purity-baseline.json');

const TRACKED_SURFACES = Object.freeze([
  'src/components/scan/LiveCameraScanner.jsx',
  'src/pages/ScanPage.jsx',
]);

// Patterns that signal duplicate ownership of state ScanRuntime
// already manages. Each pattern is a regex run against the source.
const FORBIDDEN_PATTERNS = Object.freeze([
  { id: 'useState_preview',   re: /useState\([^)]*\)[^;]{0,40}\/\/\s*ObjectURL/i,
    label: 'useState ObjectURL preview' },
  { id: 'useState_previewUrl',re: /useState\([^)]*\).*\bpreviewUrl\b/i,
    label: 'useState previewUrl' },
  { id: 'useState_imageUrl',  re: /useState\([^)]*\).*\bimageUrl\b/i,
    label: 'useState imageUrl' },
  { id: 'useState_scanResult',re: /useState\([^)]*\).*\bscanResult\b/i,
    label: 'useState scanResult' },
  { id: 'useState_lowConfidence',
    re: /useState\([^)]*\).*\blowConfidence\b/i,
    label: 'useState lowConfidence' },
  { id: 'direct_revokeObjectURL',
    re: /URL\.revokeObjectURL\(/g,
    label: 'direct URL.revokeObjectURL call' },
  { id: 'direct_createObjectURL',
    re: /URL\.createObjectURL\(/g,
    label: 'direct URL.createObjectURL call' },
  // Final Scan Consumer Migration — ScanPage must not call
  // analysis engines directly. They live inside the runtime
  // classifier or in dead code paths gated by `if (false)`.
  { id: 'direct_analyzeScan',
    re: /[^a-zA-Z_]analyzeScan\(/g,
    label: 'direct analyzeScan call' },
  { id: 'direct_analyzeImageSafe',
    re: /[^a-zA-Z_]analyzeImageSafe\(/g,
    label: 'direct analyzeImageSafe call' },
  { id: 'direct_hybridAnalyze',
    re: /[^a-zA-Z_]hybridAnalyze\(/g,
    label: 'direct hybridAnalyze call' },
]);

const SURFACE_HEADER = '[check:scan-ui-purity]';

function _countMatches(source, re) {
  if (!re.global) {
    return re.test(source) ? 1 : 0;
  }
  const matches = source.match(re);
  return matches ? matches.length : 0;
}

function _scanSurface(relPath) {
  const fullPath = resolve(ROOT, relPath);
  if (!existsSync(fullPath)) {
    return { relPath, found: false, violations: {} };
  }
  const source = readFileSync(fullPath, 'utf8');
  const violations = {};
  for (const p of FORBIDDEN_PATTERNS) {
    const n = _countMatches(source, p.re);
    if (n > 0) violations[p.id] = n;
  }
  return { relPath, found: true, violations };
}

function _readBaseline() {
  if (!existsSync(BASELINE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function _writeBaseline(baseline) {
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n', 'utf8');
}

function _diffViolations(current, baseline) {
  const exceedances = [];
  const improvements = [];
  for (const surface of TRACKED_SURFACES) {
    const cur = (current[surface] && current[surface].violations) || {};
    const base = (baseline[surface] && baseline[surface].violations) || {};
    const allIds = new Set([...Object.keys(cur), ...Object.keys(base)]);
    for (const id of allIds) {
      const c = cur[id] || 0;
      const b = base[id] || 0;
      if (c > b) exceedances.push({ surface, id, current: c, baseline: b });
      if (c < b) improvements.push({ surface, id, current: c, baseline: b });
    }
  }
  return { exceedances, improvements };
}

function main() {
  const args = process.argv.slice(2);
  const tighten = args.includes('--tighten') || args.includes('--write');

  const current = {};
  for (const surface of TRACKED_SURFACES) {
    current[surface] = _scanSurface(surface);
  }

  const baseline = _readBaseline();

  if (tighten) {
    _writeBaseline(current);
    console.log(SURFACE_HEADER, 'baseline tightened.');
    for (const [surface, r] of Object.entries(current)) {
      console.log('  ' + surface + ':', r.violations);
    }
    process.exit(0);
  }

  const { exceedances, improvements } = _diffViolations(current, baseline);

  if (improvements.length > 0) {
    console.log(SURFACE_HEADER, 'improvements detected (baseline still allows current):');
    for (const i of improvements) {
      console.log('  + ' + i.surface + ' :: ' + i.id
        + ' — ' + i.current + ' (baseline ' + i.baseline + ')');
    }
    console.log(SURFACE_HEADER, 'run with `--tighten` to lock the smaller count in.');
  }

  if (exceedances.length > 0) {
    console.error(SURFACE_HEADER, 'FAIL — new duplicate ownership detected:');
    for (const e of exceedances) {
      console.error('  ✗ ' + e.surface + ' :: ' + e.id
        + ' — ' + e.current + ' (baseline ' + e.baseline + ')');
    }
    console.error('');
    console.error('The canonical ScanRuntime owns this state. Migrate the');
    console.error('surface to consume `useScanRuntime` instead — see');
    console.error('src/components/scan/ScanCapture.jsx for the migration');
    console.error('pattern. Do NOT raise the baseline to allow new violations.');
    process.exit(1);
  }

  console.log(SURFACE_HEADER, 'PASS — no new scan-UI ownership violations.');
  for (const [surface, r] of Object.entries(current)) {
    const total = Object.values(r.violations).reduce((a, b) => a + b, 0);
    console.log('  ' + surface + ' — ' + total + ' grandfathered violation(s)');
  }
  process.exit(0);
}

main();
