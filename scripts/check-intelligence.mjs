/**
 * check-intelligence.mjs — build-time guard for the unified
 * intelligence facade (Intelligence Unification Upgrade, Phase 16).
 *
 * The facade src/core/intelligence/unifiedIntelligence.js wires four
 * existing engines into one pipeline. If any of those engine modules
 * is renamed or moved, the facade silently breaks at runtime — Home
 * loses its adaptive task, the snapshot returns fallbacks. This guard
 * fails the build BEFORE that ships:
 *
 *   1. The facade file exists.
 *   2. Every relative import in the facade resolves to a real file.
 *   3. The four engine entry points are still exported by name.
 *
 * No network, no build step — pure source inspection. Exit 1 on any
 * failure with a human-readable reason.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FACADE = 'src/core/intelligence/unifiedIntelligence.js';

function fail(msg) {
  console.error('[check:intelligence] FAIL — ' + msg);
  process.exit(1);
}

const facadeAbs = resolve(ROOT, FACADE);
if (!existsSync(facadeAbs)) {
  fail('missing facade module: ' + FACADE);
}
const src = readFileSync(facadeAbs, 'utf8');

// 1. Every relative import must resolve to a real file on disk.
const importRe = /from\s+'(\.[^']+)'/g;
const facadeDir = dirname(facadeAbs);
const unresolved = [];
let m;
while ((m = importRe.exec(src)) !== null) {
  const spec = m[1];
  const abs = resolve(facadeDir, spec);
  if (!existsSync(abs)) unresolved.push(spec);
}
if (unresolved.length > 0) {
  fail('facade imports that do not exist on disk:\n  • ' + unresolved.join('\n  • '));
}

// 2. The four engine entry points must still be exported by name.
//    Each row: [module path from repo root, exported symbol].
const ENGINES = [
  ['src/lib/farmContextEngine.js',            'getFarmContext'],
  ['src/lib/farmIntelligenceSnapshot.js',     'getFarmIntelligence'],
  ['src/lib/intelligence/contextEngine.js',   'computeContextIntelligence'],
  ['src/lib/regions.js',                      'resolveRegion'],
];

const missingExports = [];
for (const [rel, symbol] of ENGINES) {
  const abs = resolve(ROOT, rel);
  if (!existsSync(abs)) {
    missingExports.push(`${rel} (file missing)`);
    continue;
  }
  const body = readFileSync(abs, 'utf8');
  // Accept `export function NAME`, `export const NAME`, or a named
  // re-export `export { NAME` / `, NAME` inside an export block.
  const declared = new RegExp('export\\s+(?:async\\s+)?(?:function|const|let|class)\\s+' + symbol + '\\b').test(body);
  const reexported = new RegExp('export\\s*\\{[^}]*\\b' + symbol + '\\b').test(body);
  if (!declared && !reexported) {
    missingExports.push(`${rel} no longer exports ${symbol}`);
  }
}
if (missingExports.length > 0) {
  fail('engine contract broken:\n  • ' + missingExports.join('\n  • '));
}

// 3. The facade must expose its public entry point.
if (!/export\s+function\s+getUnifiedIntelligence\b/.test(src)) {
  fail('facade no longer exports getUnifiedIntelligence');
}

console.log('[check:intelligence] PASS — facade wired to '
  + ENGINES.length + ' engines, all imports resolve, contract intact.');
