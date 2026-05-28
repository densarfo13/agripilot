#!/usr/bin/env node
/**
 * check-api-runtime-ownership.mjs — wave 3 CI ratchet.
 *
 *   node scripts/check-api-runtime-ownership.mjs
 *
 * What this is
 * ────────────
 *   After wave 3 of the architecture migration, ZERO UI surfaces
 *   (src/pages/**, src/components/**, src/features/**, src/App.jsx)
 *   may import `src/api/client.js` directly. They must route via:
 *
 *     • src/runtime/apiRuntime.js                    (facade)
 *     • src/hooks/useApiClient.js                    (hook)
 *     • src/hooks/useApiResource.js                  (generic data)
 *     • src/hooks/useFarmerNotificationsRuntime.js   (domain hook)
 *     • (future) domain-specific runtime hooks
 *
 *   The general layer guard (check-layer-boundaries.mjs) catches
 *   this via the UI→INFRASTRUCTURE rule, but this guard makes the
 *   intent visible AND specifically pins the api/client.js bucket
 *   so a regression has a clear error message.
 *
 *   This is a HARD gate — there is no baseline file. The current
 *   state is zero direct UI imports; any new one fails the build.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const SRC       = resolve(ROOT, 'src');
const HEADER    = '[check:api-runtime-ownership]';

// UI surfaces — same prefix set as the layer guard's UI layer.
const UI_PREFIXES = [
  'src/pages/',
  'src/components/',
  'src/features/',
  'src/screens/',
];
const ROOT_FILES = ['src/App.jsx'];

const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git',
  '__tests__', '__fixtures__',
]);
const EXTS = new Set(['.js', '.jsx', '.ts', '.tsx']);

// Static-import regex — matches `import ... from '...api/client...'`.
// Does NOT match dynamic `import('...api/client.js')` so the App.jsx
// recovery boundaries (which lazy-load the client only when
// auth/refresh is being rebuilt) can still work.
const IMPORT_RE = /(?:^|\n)\s*import\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/g;

function _walk(dir, out) {
  for (const e of readdirSync(dir)) {
    if (SKIP_DIRS.has(e)) continue;
    const full = join(dir, e);
    const st = statSync(full);
    if (st.isDirectory()) _walk(full, out);
    else if (EXTS.has(e.slice(e.lastIndexOf('.')))) out.push(full);
  }
  return out;
}

function _relPath(abs) {
  return relative(ROOT, abs).replace(/\\/g, '/');
}

function _isUiSurface(rel) {
  if (ROOT_FILES.includes(rel)) return true;
  return UI_PREFIXES.some((p) => rel.startsWith(p));
}

function _extractImports(source) {
  const out = [];
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(source)) !== null) out.push(m[1]);
  return out;
}

function _importsApiClient(imp) {
  // Matches relative paths like '../api/client', '../../api/client.js',
  // './api/client', etc. Does NOT match the runtime/service facades.
  return /(?:^|[./])api\/client(?:\.js)?$/.test(imp);
}

function main() {
  const files = _walk(SRC, []);
  const offenders = [];
  for (const abs of files) {
    const rel = _relPath(abs);
    if (!_isUiSurface(rel)) continue;
    const src = readFileSync(abs, 'utf8');
    const imports = _extractImports(src);
    for (const imp of imports) {
      if (_importsApiClient(imp)) {
        offenders.push({ file: rel, import: imp });
      }
    }
  }

  if (offenders.length > 0) {
    console.error(HEADER, 'FAIL — UI surfaces must NOT import api/client.js.');
    for (const o of offenders) {
      console.error('  ✗ ' + o.file + ' :: ' + o.import);
    }
    console.error('');
    console.error('Use the RUNTIME facade instead:');
    console.error('  import api, { formatApiError } '
      + "from 'src/runtime/apiRuntime.js';");
    console.error('Or build a domain hook (see '
      + 'src/hooks/useFarmerNotificationsRuntime.js as a template).');
    process.exit(1);
  }

  console.log(HEADER, 'PASS — 0 UI surfaces import api/client.js directly.');
  console.log('  scanned ' + files.length + ' file(s).');
  process.exit(0);
}

main();
