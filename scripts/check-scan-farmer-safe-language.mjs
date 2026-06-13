/**
 * check-scan-farmer-safe-language.mjs — sprint #200 spec §10.
 *
 * Scan-specific farmer-safety guard. Distinct from the app-wide
 * check-farmer-facing-ai-language (#198): this one focuses on the
 * scan surface + composer and adds the UNSAFE-DOSAGE check the
 * scan spec requires.
 *
 * Fails build if, in src/components/scan/** or the scanMythos
 * composer/explainer, a STRING LITERAL contains:
 *   - a provider name (Plant.id / PlantNet / Insect.id / SoilGrids /
 *     Cloudinary / Sentinel)
 *   - an unsafe chemical dosage token (mg/L, kg/ha, g/L, /litre,
 *     named pesticides)
 * Comments stripped first so rationale doesn't false-flag.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const errors = [];

function read(rel) { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return ''; } }
function strip(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/[^\n]*/gm, '$1');
}
function* walk(dir) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (/\.(jsx?|tsx?)$/.test(e.name)) yield path.relative(ROOT, full).replace(/\\/g, '/');
  }
}
function stringLiterals(line) {
  const out = []; const re = /(['"])((?:\\.|(?!\1).)*)\1/g; let m;
  while ((m = re.exec(line)) !== null) out.push(m[2]);
  return out;
}

const PROVIDERS = [/Plant\.id/i, /PlantNet/i, /Insect\.id/i, /SoilGrids/i, /Cloudinary/i, /\bSentinel\b/];
const DOSAGE = [/\bmg\/L\b/i, /\bkg\/ha\b/i, /\bg\/L\b/i, /\bml\/L\b/i, /\/litre\b/i, /\/liter\b/i,
  /glyphosate/i, /malathion/i, /imidacloprid/i, /cypermethrin/i, /paraquat/i];

const TARGETS = [];
for (const f of walk(path.join(ROOT, 'src/components/scan'))) TARGETS.push(f);
TARGETS.push('src/runtime/scanMythos/ScanDecisionComposer.ts');
TARGETS.push('src/runtime/scanMythos/ScanConfidenceExplainer.ts');

let scanned = 0;
for (const rel of TARGETS) {
  const src = read(rel);
  if (!src) continue;
  scanned++;
  const lines = strip(src).split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\b/.test(lines[i])) continue;
    for (const lit of stringLiterals(lines[i])) {
      // The contracts/composer DEFINE the forbidden lists — those
      // arrays are the gate's own source of truth, not rendered copy.
      // Skip lines that are clearly the FORBIDDEN_* declarations.
      if (/FORBIDDEN_(PROVIDER_NAMES|DOSAGE_TOKENS)/.test(lines[i])) continue;
      if (lit.startsWith('/') || lit.startsWith('.') || /^[a-z0-9._:-]+$/.test(lit)) continue;
      for (const re of PROVIDERS) if (re.test(lit))
        errors.push(rel + ':' + (i + 1) + ' provider name in scan string: ' + JSON.stringify(lit.slice(0, 50)));
      for (const re of DOSAGE) if (re.test(lit))
        errors.push(rel + ':' + (i + 1) + ' unsafe dosage in scan string: ' + JSON.stringify(lit.slice(0, 50)));
    }
  }
}

if (errors.length) {
  console.error('[check:scan-farmer-safe-language] FAIL — ' + errors.length + ' violation(s):');
  for (const e of [...new Set(errors)]) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:scan-farmer-safe-language] PASS — ' + scanned
  + ' scan files: no provider names, no unsafe chemical dosages in rendered strings.');
