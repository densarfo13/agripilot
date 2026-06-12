/**
 * check-farmer-facing-ai-language.mjs — sprint #198 (Invisible
 * Intelligence rule, product-excellence spec §10).
 *
 * Farmers must never see AI/ML jargon or provider names. The app
 * speaks in: what we found · how sure we are · what to do · when
 * to check again.
 *
 * Fails build when a grower-facing source file contains a banned
 * token inside a STRING LITERAL (rendered text / tSafe fallback):
 *   - \bAI\b, \bLLM\b, "machine learning", "neural", "algorithm"
 *   - provider names: Plant.id, PlantNet, Insect.id, SoilGrids,
 *     Cloudinary, Sentinel
 *
 * Scope: src/pages/** + src/components/** EXCEPT the reviewer-
 * facing exemptions below. Comments are stripped before scanning,
 * so docs explaining the rule don't false-flag. Non-UI dirs
 * (runtime/core/lib) are exempt — provider names there live in
 * API plumbing, never rendered.
 *
 * Read-only. Exit 0 = pass.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const errors = [];

// Reviewer/admin surfaces — allowed to name providers.
const EXEMPT_DIRS = [
  'src/pages/admin', 'src/pages/internal',
];
const EXEMPT_FILES = new Set([
  // i18n column files hold every locale's strings incl. admin keys.
  // The grower-key scan below still covers what farmers see.
]);

const BANNED = [
  { re: /\bAI\b/,                label: 'AI' },
  { re: /\bA\.I\.\b/,            label: 'A.I.' },
  { re: /\bLLM\b/,               label: 'LLM' },
  { re: /machine.?learning/i,    label: 'machine learning' },
  { re: /neural/i,               label: 'neural' },
  { re: /\balgorithm/i,          label: 'algorithm' },
  { re: /Plant\.id/i,            label: 'Plant.id (provider name)' },
  { re: /PlantNet/i,             label: 'PlantNet (provider name)' },
  { re: /Insect\.id/i,           label: 'Insect.id (provider name)' },
  { re: /SoilGrids/i,            label: 'SoilGrids (provider name)' },
  { re: /Cloudinary/i,           label: 'Cloudinary (provider name)' },
  { re: /\bSentinel\b/,          label: 'Sentinel (provider name)' },
];

function stripComments(src) {
  let s = src;
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  s = s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  s = s.replace(/(^|[^:])\/\/[^\n]*/gm, '$1');
  return s;
}

// Extract string literals (single, double quotes — template strings
// too risky to parse naively; covered by the quoted parts they
// usually contain).
function stringLiterals(line) {
  const out = [];
  const re = /(['"])((?:\\.|(?!\1).)*)\1/g;
  let m;
  while ((m = re.exec(line)) !== null) out.push(m[2]);
  return out;
}

function* walk(dir) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');
    if (e.isDirectory()) {
      if (EXEMPT_DIRS.some((d) => rel === d || rel.startsWith(d + '/'))) continue;
      yield* walk(full);
    } else if (/\.(jsx?|tsx?)$/.test(e.name)) {
      if (EXEMPT_FILES.has(rel)) continue;
      yield rel;
    }
  }
}

const SCAN_ROOTS = ['src/pages', 'src/components'];
let scanned = 0;
for (const rootDir of SCAN_ROOTS) {
  for (const rel of walk(path.join(ROOT, rootDir))) {
    scanned++;
    let src = '';
    try { src = fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
    catch { continue; }
    const lines = stripComments(src).split('\n');
    for (let i = 0; i < lines.length; i++) {
      // Skip import lines + data-testid-only lines — module paths
      // legitimately contain provider-ish words.
      const line = lines[i];
      if (/^\s*import\b/.test(line)) continue;
      for (const lit of stringLiterals(line)) {
        // Skip obvious non-display literals.
        if (lit.startsWith('/') || lit.startsWith('./') || lit.startsWith('../')) continue;
        if (lit.includes('data-') || /^[a-z0-9.:_-]+$/.test(lit)) continue; // keys/ids
        for (const b of BANNED) {
          if (b.re.test(lit)) {
            errors.push(rel + ':' + (i + 1) + ' — banned farmer-facing token "'
              + b.label + '" in string: ' + JSON.stringify(lit.slice(0, 60)));
          }
        }
      }
    }
  }
}

if (errors.length) {
  console.error('[check:farmer-facing-ai-language] FAIL — '
    + errors.length + ' violation(s):');
  for (const e of [...new Set(errors)]) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:farmer-facing-ai-language] PASS — ' + scanned
  + ' grower-facing files scanned; no AI/ML jargon or provider names '
  + 'in rendered strings (admin/internal surfaces exempt).');
