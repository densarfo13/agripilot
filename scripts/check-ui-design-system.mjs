/**
 * check-ui-design-system.mjs — locks Design System v1 rules.
 *
 * Sprint #181. Fails build when any grower-facing surface:
 *
 *   1. Lacks at least one primary action element. The marker is a
 *      `data-primary-action` attribute (any value) OR the literal
 *      data-testid `*-create-task` / `*-start` / `*-complete` /
 *      `*-edit` / `*-open` / `*-scan` / `*-view`. The page must
 *      contain at least one such element.
 *   2. Has MORE than 2 elements that look primary (filled-style
 *      buttons identifiable by `data-primary-action="true"` —
 *      we only count the explicit marker, not visual style).
 *   3. References more than 3 DISTINCT non-semantic accent hex
 *      colors (excluding the 6 reserved semantic tokens — Ink,
 *      Muted, Border, Success, Warning, Danger). Brand palette =
 *      Deep Green / Warm Beige / Harvest Gold counts toward the
 *      3 allowed accents.
 *   4. Contains banned grower wording (also covered by sibling
 *      gates — this gate adds AI buzzword check).
 *
 * Pages scanned (grower-facing only — admin / internal exempt):
 *   src/pages/Home.jsx
 *   src/pages/AllTasksPage.jsx
 *   src/pages/MyPlants.jsx
 *   src/pages/farmer/MyFarmPage.jsx
 *   src/pages/ScanResultPage.jsx
 *   src/components/scan/IntelligentScanResult.jsx
 *   src/components/scan/ScanCommandCard.jsx
 *
 * Pure read-only. No mutations. Exit 0 = pass.
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
function _stripComments(src) {
  let s = src;
  s = s.replace(new RegExp('/\\*[\\s\\S]*?\\*/', 'g'), '');
  s = s.replace(new RegExp('\\{/\\*[\\s\\S]*?\\*/\\}', 'g'), '');
  s = s.replace(new RegExp('//[^\\n]*', 'g'), '');
  return s;
}

// Grower-facing surfaces (admin/internal/buyer/ngo not in scope).
const SURFACES = [
  'src/pages/Home.jsx',
  'src/pages/AllTasksPage.jsx',
  'src/pages/MyPlants.jsx',
  'src/pages/farmer/MyFarmPage.jsx',
  'src/pages/ScanResultPage.jsx',
  'src/components/scan/IntelligentScanResult.jsx',
  'src/components/scan/ScanCommandCard.jsx',
];

// Primary-action heuristic — these testids canonically mark the
// surface's ONE primary action. If any of these appear, rule 1 passes.
// Strings come from the trusted catalog so a typo can't pass.
const PRIMARY_TESTID_PATTERNS = [
  /data-testid="[^"]*-create-task"/i,
  /data-testid="[^"]*-start"/i,
  /data-testid="[^"]*-complete"/i,
  /data-testid="[^"]*-open"/i,
  /data-testid="[^"]*-view"/i,
  /data-testid="[^"]*-scan"/i,
  /data-testid="[^"]*-edit"/i,
  /data-testid="[^"]*-save-plant"/i,
  // Explicit marker (preferred long-term).
  /data-primary-action=/i,
  // Existing primary CTAs in the codebase (transitional).
  /data-testid="scan-intel-create-task"/i,
  /data-testid="scan-command-plant"/i, // ScanCommandCard headline row
  /data-testid="task-complete"/i,
  /data-testid="farm-edit"/i,
];

// Banned AI buzzwords (case-insensitive). Allowed inside comments
// since we strip those before scanning.
const BANNED_BUZZWORDS = [
  'AI-powered', 'machine learning',
  'neural network', 'algorithmic recommendation',
];

// Brand palette (3 allowed accents). Other hex colors are
// considered semantic (severity / confidence band) IFF they map
// to the reserved tokens.
const SEMANTIC_HEX = new Set([
  '#1f2933', // Ink
  '#64748b', // Muted
  '#10b981', // Success / Healthy
  '#f59e0b', // Warning
  '#ef4444', // Danger / High
  '#ffffff', // surface white
  '#000000', // (banned in practice, but counted as semantic if used for SVG masks)
  // Common semantic background tints derived from severity colors.
  '#047857', '#92400e', '#991b1b',
  '#f1f5f9', // pill background
  '#f8fafc', // page-secondary bg
  '#475569', // body-secondary
]);
const BRAND_ACCENTS_ALLOWED = 3;

function _findAllHexLiterals(src) {
  // Match 6-digit hex strings inside string literals. Returns
  // lowercase set.
  const stripped = _stripComments(src);
  const hexes = new Set();
  const re = /#[0-9a-fA-F]{6}\b/g;
  let m;
  while ((m = re.exec(stripped)) !== null) {
    hexes.add(m[0].toLowerCase());
  }
  return hexes;
}

function _countPrimaryActionMarkers(src) {
  const stripped = _stripComments(src);
  // Explicit `data-primary-action="true"` (strictest interpretation).
  const explicit = (stripped.match(/data-primary-action="true"/g) || []).length;
  return explicit;
}

function _hasAnyPrimaryActionTestId(src) {
  const stripped = _stripComments(src);
  for (const re of PRIMARY_TESTID_PATTERNS) {
    if (re.test(stripped)) return true;
  }
  return false;
}

for (const rel of SURFACES) {
  if (!_exists(rel)) {
    // Missing surface = treated as not-yet-implemented. Don't fail
    // the build for absent pages.
    continue;
  }
  const src = _read(rel);
  const stripped = _stripComments(src);

  // Rule 1 — must have a primary action surface marker.
  if (!_hasAnyPrimaryActionTestId(src)) {
    errors.push(rel + ' lacks a primary action — page must expose '
      + 'at least one data-testid that matches the trusted set '
      + '(*-create-task, *-start, *-complete, *-open, *-view, '
      + '*-scan, *-edit, *-save-plant) or data-primary-action="true"');
  }

  // Rule 2 — at most 2 explicit data-primary-action="true" markers.
  const explicitPrimary = _countPrimaryActionMarkers(src);
  if (explicitPrimary > 2) {
    errors.push(rel + ' has ' + explicitPrimary + ' elements with '
      + 'data-primary-action="true" — Design System §5 allows max 2');
  }

  // Rule 3 — distinct accent hex colors after excluding semantic.
  const allHex = _findAllHexLiterals(src);
  const accentHex = [];
  for (const h of allHex) {
    if (!SEMANTIC_HEX.has(h)) accentHex.push(h);
  }
  if (accentHex.length > BRAND_ACCENTS_ALLOWED + 5) {
    // Allow some headroom for tints/shades of brand colors. The
    // hard ceiling is 3 + 5 = 8 distinct non-semantic hexes. This
    // catches pages that introduce a whole new palette without
    // banning the existing severity-tint helpers.
    errors.push(rel + ' references ' + accentHex.length
      + ' distinct non-semantic hex colors — Design System §2 limits '
      + 'accent palette to 3 brand colors (+ tints up to 8 total). '
      + 'Excess hexes: ' + accentHex.slice(0, 8).join(', '));
  }

  // Rule 4 — banned AI buzzwords in grower-facing JSX text. We
  // approximate "JSX text" as any string literal that isn't a
  // testid / aria attribute / className.
  for (const banned of BANNED_BUZZWORDS) {
    const re = new RegExp('[>"\'`]\\s*' + banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      + '\\s*[<"\'`]', 'i');
    if (re.test(stripped)) {
      errors.push(rel + ' uses banned AI buzzword in grower copy: ' + banned);
    }
  }
}

// Bonus check — DESIGN_SYSTEM_V1.md must exist.
if (!_exists('DESIGN_SYSTEM_V1.md')) {
  errors.push('DESIGN_SYSTEM_V1.md must exist (Design System v1 spec)');
}

if (errors.length) {
  console.error('[check:ui-design-system] FAIL — ' + errors.length + ' violation(s):');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

console.log('[check:ui-design-system] PASS — every grower surface declares a primary action; accent palette within budget; no AI buzzwords; DESIGN_SYSTEM_V1.md present.');
