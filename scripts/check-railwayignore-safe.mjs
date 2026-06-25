/**
 * check-railwayignore-safe.mjs — deployment reliability guard.
 *
 * A bare directory name in .railwayignore matches at ANY depth (gitignore
 * semantics), so an entry like `reports` silently strips real source dirs
 * (src/runtime/reports, server/src/modules/reports) from the `railway up`
 * snapshot → the Docker `vite build` fails with "Could not resolve …". This
 * gate fails the build if any .railwayignore pattern would strip TRACKED source
 * under src/ or server/src/. Fix = root-anchor the pattern (e.g. `/reports/`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const IGNORE = '.railwayignore';
if (!fs.existsSync(path.join(R, IGNORE))) {
  console.log('[check:railwayignore-safe] PASS — no .railwayignore.');
  process.exit(0);
}

// Tracked source files that MUST reach the build.
let tracked = [];
try {
  tracked = execSync('git ls-files src server/src', { cwd: R, encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter(Boolean);
} catch { tracked = []; }

const lines = fs.readFileSync(path.join(R, IGNORE), 'utf8').split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));

const E = [];
for (const pat of lines) {
  // Only bare, unanchored, wildcard-free directory names match at any depth.
  // Anchored (`/foo`), nested (`a/b`), and globs (`*.md`) are specific enough.
  if (pat.startsWith('/') || pat.includes('/') || pat.includes('*')) continue;
  const seg = pat.replace(/\/+$/, '');
  if (!seg) continue;
  // Does any tracked source path contain this as a path segment?
  const hit = tracked.find((f) => f.split('/').includes(seg));
  if (hit) {
    E.push(`pattern "${pat}" strips tracked source (e.g. ${hit}) — root-anchor it as "/${seg}/"`);
  }
}

if (E.length) {
  console.error('[check:railwayignore-safe] FAIL — ' + E.length + ' over-broad pattern(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:railwayignore-safe] PASS — no .railwayignore pattern strips tracked src/ or server/src/ source.');
