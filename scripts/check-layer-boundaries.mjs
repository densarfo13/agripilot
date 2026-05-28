#!/usr/bin/env node
/**
 * check-layer-boundaries.mjs — Farroway layered architecture
 * enforcement.
 *
 *   node scripts/check-layer-boundaries.mjs
 *
 * Reads src/architecture/layers.js (declarative layer definitions)
 * and walks every .js / .jsx / .ts / .tsx in src/. For each file:
 *   1. Classify into a layer via path prefix.
 *   2. Parse import statements.
 *   3. For each import, classify the target's layer.
 *   4. Verify (source layer) → (target layer) is in ALLOWED_IMPORTS.
 *   5. Scan source for FORBIDDEN_IN_<LAYER> regex patterns.
 *
 * Ratcheted — baseline file grandfathers current violations so the
 * migration is enforced for new code immediately. Run with
 * `--tighten` to lock the current state into the baseline after a
 * cleanup PR.
 *
 *   Baseline: scripts/.layer-boundaries-baseline.json
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const BASELINE_PATH = resolve(__dirname, '.layer-boundaries-baseline.json');
const SRC_ROOT = resolve(ROOT, 'src');
const HEADER = '[check:layers]';

// Load layer definitions via dynamic import (ES module).
const layersUrl = pathToFileURL(resolve(SRC_ROOT, 'architecture/layers.js')).href;
const {
  LAYER, LAYER_PREFIXES, ALLOWED_IMPORTS,
  FORBIDDEN_IN_UI, FORBIDDEN_IN_INFRASTRUCTURE,
} = await import(layersUrl);

const FILE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '__tests__', '__fixtures__']);

function _walk(dir, out) {
  const entries = readdirSync(dir);
  for (const e of entries) {
    if (SKIP_DIRS.has(e)) continue;
    const full = join(dir, e);
    const st = statSync(full);
    if (st.isDirectory()) {
      _walk(full, out);
    } else {
      const ext = e.slice(e.lastIndexOf('.'));
      if (FILE_EXTENSIONS.has(ext)) out.push(full);
    }
  }
  return out;
}

function _layerFor(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  for (const [prefix, layer] of LAYER_PREFIXES) {
    if (normalized.startsWith(prefix)) return layer;
  }
  return null; // unclassified — treated as a shared utility, not layer-checked
}

const IMPORT_RE = /(?:^|\n)\s*import\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/g;

function _extractImports(source) {
  const out = [];
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(source)) !== null) out.push(m[1]);
  return out;
}

function _resolveImportToLayer(importPath, fromFile) {
  // Bare specifiers (node_modules) — skip layer checks.
  if (!importPath.startsWith('.') && !importPath.startsWith('/')
      && !importPath.startsWith('src/')) {
    return null;
  }
  // Resolve relative import to absolute path.
  let abs;
  if (importPath.startsWith('src/')) {
    abs = resolve(ROOT, importPath);
  } else {
    abs = resolve(dirname(fromFile), importPath);
  }
  const relPath = relative(ROOT, abs).replace(/\\/g, '/');
  return _layerFor(relPath);
}

function _scanFile(absPath) {
  const relPath = relative(ROOT, absPath).replace(/\\/g, '/');
  const sourceLayer = _layerFor(relPath);
  if (!sourceLayer) return null; // unclassified

  const source = readFileSync(absPath, 'utf8');
  const imports = _extractImports(source);
  const violations = [];

  // 1) Cross-layer import direction.
  const allowed = ALLOWED_IMPORTS[sourceLayer] || [];
  for (const imp of imports) {
    const targetLayer = _resolveImportToLayer(imp, absPath);
    if (!targetLayer) continue;
    if (sourceLayer === targetLayer) continue;
    if (allowed.includes(targetLayer)) continue;
    violations.push({
      kind:        'cross_layer_import',
      sourceLayer,
      targetLayer,
      import:      imp,
    });
  }

  // 2) Layer-specific forbidden patterns.
  if (sourceLayer === LAYER.UI) {
    for (const p of FORBIDDEN_IN_UI) {
      if (p.re.test(source)) {
        violations.push({
          kind:        'forbidden_pattern',
          sourceLayer,
          patternId:   p.id,
          label:       p.label,
        });
      }
    }
  } else if (sourceLayer === LAYER.INFRASTRUCTURE) {
    for (const p of FORBIDDEN_IN_INFRASTRUCTURE) {
      if (p.re.test(source)) {
        violations.push({
          kind:        'forbidden_pattern',
          sourceLayer,
          patternId:   p.id,
          label:       p.label,
        });
      }
    }
  }

  if (violations.length === 0) return null;
  return { relPath, sourceLayer, violations };
}

function _readBaseline() {
  if (!existsSync(BASELINE_PATH)) return {};
  try { return JSON.parse(readFileSync(BASELINE_PATH, 'utf8')); }
  catch { return {}; }
}

function _writeBaseline(b) {
  writeFileSync(BASELINE_PATH, JSON.stringify(b, null, 2) + '\n', 'utf8');
}

function _violationKey(v) {
  if (v.kind === 'cross_layer_import') {
    return v.kind + ':' + v.sourceLayer + '→' + v.targetLayer + ':' + v.import;
  }
  return v.kind + ':' + v.patternId;
}

function _toBaseline(byFile) {
  const out = {};
  for (const [file, rec] of Object.entries(byFile)) {
    const keys = rec.violations.map(_violationKey).sort();
    out[file] = { sourceLayer: rec.sourceLayer, violationKeys: keys };
  }
  return out;
}

function _diff(current, baseline) {
  const newViolations = [];
  const cleared = [];
  for (const [file, rec] of Object.entries(current)) {
    const baseKeys = new Set(((baseline[file] || {}).violationKeys) || []);
    for (const v of rec.violations) {
      const key = _violationKey(v);
      if (!baseKeys.has(key)) newViolations.push({ file, v });
    }
  }
  for (const [file, rec] of Object.entries(baseline)) {
    const curKeys = new Set(((current[file] || { violations: [] }).violations || [])
      .map(_violationKey));
    for (const key of rec.violationKeys || []) {
      if (!curKeys.has(key)) cleared.push({ file, key });
    }
  }
  return { newViolations, cleared };
}

function _categorize(byFile) {
  // Group violations into actionable migration buckets.
  const byTargetLayer    = {};
  const byImportPath     = {};
  const bySourceLayer    = {};
  const topFiles         = {};
  for (const [file, rec] of Object.entries(byFile)) {
    bySourceLayer[rec.sourceLayer] = (bySourceLayer[rec.sourceLayer] || 0)
      + rec.violations.length;
    topFiles[file] = rec.violations.length;
    for (const v of rec.violations) {
      if (v.kind === 'cross_layer_import') {
        byTargetLayer[v.targetLayer] = (byTargetLayer[v.targetLayer] || 0) + 1;
        // Normalize the import path into a wave bucket
        const parts = v.import.replace(/^\.\.+\//g, '').split('/').slice(0, 2);
        const bucket = parts.join('/');
        if (!byImportPath[bucket]) byImportPath[bucket] = { count: 0, files: new Set() };
        byImportPath[bucket].count += 1;
        byImportPath[bucket].files.add(file);
      }
    }
  }
  return {
    bySourceLayer,
    byTargetLayer,
    byImportPath: Object.fromEntries(
      Object.entries(byImportPath)
        .map(([k, v]) => [k, { count: v.count, files: Array.from(v.files).sort() }])
        .sort((a, b) => b[1].count - a[1].count),
    ),
    topFilesByCount: Object.fromEntries(
      Object.entries(topFiles).sort((a, b) => b[1] - a[1]).slice(0, 20),
    ),
  };
}

function main() {
  const args = process.argv.slice(2);
  const tighten = args.includes('--tighten') || args.includes('--write');
  const report  = args.includes('--report');

  const files = _walk(SRC_ROOT, []);
  const byFile = {};
  for (const f of files) {
    const r = _scanFile(f);
    if (r) byFile[r.relPath] = r;
  }

  if (report) {
    const cat = _categorize(byFile);
    const out = {
      totalFiles:      Object.keys(byFile).length,
      totalViolations: Object.values(byFile).reduce((a, r) => a + r.violations.length, 0),
      bySourceLayer:   cat.bySourceLayer,
      byTargetLayer:   cat.byTargetLayer,
      topImportBuckets: Object.entries(cat.byImportPath).slice(0, 15).reduce(
        (a, [k, v]) => { a[k] = { count: v.count, fileCount: v.files.length }; return a; },
        {},
      ),
      topFiles: cat.topFilesByCount,
      migrationWaves: {
        wave1_api_client:    cat.byImportPath['api/client.js']     || { count: 0 },
        wave2_lib_api:       cat.byImportPath['lib/api.js']        || { count: 0 },
        wave3_market:        cat.byImportPath['market']            || { count: 0 },
        wave4_data:          cat.byImportPath['data']              || { count: 0 },
        wave5_services:      cat.byImportPath['services']          || { count: 0 },
      },
    };
    console.log(JSON.stringify(out, null, 2));
    process.exit(0);
  }

  const currentBaseline = _toBaseline(byFile);
  const baseline = _readBaseline();

  if (tighten) {
    _writeBaseline(currentBaseline);
    const total = Object.values(byFile).reduce((a, r) => a + r.violations.length, 0);
    console.log(HEADER, 'baseline tightened —', Object.keys(byFile).length,
      'file(s) with', total, 'grandfathered violation(s).');
    process.exit(0);
  }

  const { newViolations, cleared } = _diff(byFile, baseline);

  if (cleared.length > 0) {
    console.log(HEADER, cleared.length, 'violation(s) cleared since baseline:');
    for (const c of cleared.slice(0, 10)) {
      console.log('  + ' + c.file + ' :: ' + c.key);
    }
    console.log(HEADER, 'run with `--tighten` to lock the improvements in.');
  }

  if (newViolations.length > 0) {
    console.error(HEADER, 'FAIL —', newViolations.length, 'new layer violation(s):');
    for (const n of newViolations.slice(0, 30)) {
      const v = n.v;
      if (v.kind === 'cross_layer_import') {
        console.error('  ✗ ' + n.file
          + ' [' + v.sourceLayer + '] → [' + v.targetLayer + ']: ' + v.import);
      } else {
        console.error('  ✗ ' + n.file + ' [' + v.sourceLayer + ']: ' + v.label);
      }
    }
    if (newViolations.length > 30) {
      console.error('  ... and ' + (newViolations.length - 30) + ' more');
    }
    console.error('');
    console.error('Layer rules live in src/architecture/layers.js. Pick the');
    console.error('migration target from there; do NOT raise the baseline to');
    console.error('allow new violations.');
    process.exit(1);
  }

  const totalFiles = Object.keys(byFile).length;
  const totalViolations = Object.values(byFile).reduce(
    (a, r) => a + r.violations.length, 0);
  console.log(HEADER, 'PASS — no new layer violations.');
  console.log('  ' + totalFiles + ' file(s) with '
    + totalViolations + ' grandfathered violation(s).');
  process.exit(0);
}

main();
