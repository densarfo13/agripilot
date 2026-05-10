#!/usr/bin/env node
/**
 * check-garden-principles.mjs
 *
 * CI guard — enforces the locked Garden Experience Principles
 * declared in `src/principles/gardenPrinciples.js`.
 *
 *   node scripts/ci/check-garden-principles.mjs
 *     → 0 when every guarded file is clean
 *     → 1 when a violation is found
 *
 * What this guard checks
 * ──────────────────────
 *   1. **Forbidden alarm wording** in user-facing strings —
 *      "high risk", "critical risk/issue/disease", "urgent",
 *      "severe damage", "danger", "alarm" (Principle 4).
 *
 *   2. **AI / model jargon** in user-facing strings — "AI
 *      confidence", "risk score", "confidence: <number>",
 *      "model output/score/prediction", "detection score"
 *      (Principle 10).
 *
 *   3. **Commercial wording** in garden-mode surfaces —
 *      "harvest ready", "yield" (Principle 1 — calm over
 *      commercial).
 *
 *   4. **Forbidden visual literals** — `#22C55E`, `#16A34A`,
 *      `#0B1D34`, `#062714` (Principle 8 — realism over
 *      synthetic).
 *
 * Files scanned
 * ─────────────
 * Pulled from `GARDEN_GUARDED_FILES` in
 * `src/principles/gardenPrinciples.js`. Both shared (mode-
 * branched) and garden-only files. New garden surfaces should
 * be added there so the guard catches them on day one.
 *
 * Exemptions
 * ──────────
 *   • Lines starting with `//`, ` *`, or `/*` are treated as
 *     comments and not checked. Principles can be DISCUSSED in
 *     comments without violating themselves.
 *   • Lines containing `data-testid=` or `aria-*=` are not
 *     checked — those are DOM hooks, not user-visible copy.
 *   • Re-exports from / imports of `gardenPrinciples.js` itself
 *     are skipped.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = resolve(process.cwd());
const PRINCIPLES_PATH = resolve(REPO_ROOT, 'src/principles/gardenPrinciples.js');

if (!existsSync(PRINCIPLES_PATH)) {
  console.error('check-garden-principles: src/principles/gardenPrinciples.js not found.');
  process.exit(1);
}

// Dynamic-import the principles module so the guard always reads
// the canonical lists. Resolves edits to the principles without
// a separate update to this guard.
const principlesUrl = pathToFileURL(PRINCIPLES_PATH).href;
const principles = await import(principlesUrl);
const {
  FORBIDDEN_GARDEN_WORDS,
  FORBIDDEN_GARDEN_COLORS,
  GARDEN_GUARDED_FILES,
} = principles;

if (!Array.isArray(FORBIDDEN_GARDEN_WORDS)
    || !Array.isArray(FORBIDDEN_GARDEN_COLORS)
    || !Array.isArray(GARDEN_GUARDED_FILES)) {
  console.error('check-garden-principles: principles module missing expected exports.');
  process.exit(1);
}

const violations = [];

for (const rel of GARDEN_GUARDED_FILES) {
  const abs = resolve(REPO_ROOT, rel);
  if (!existsSync(abs)) {
    // Don't fail when the listed file doesn't exist — surfaces
    // get renamed; the principles file should be updated, but a
    // missing file is not a violation in itself.
    console.warn(`check-garden-principles: skipping missing file ${rel}`);
    continue;
  }

  const src = readFileSync(abs, 'utf8');
  const lines = src.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip comments — principles can be discussed in comments.
    if (trimmed.startsWith('//')) continue;
    if (trimmed.startsWith('*'))  continue;
    if (trimmed.startsWith('/*')) continue;

    // Skip DOM-hook attributes (not user-visible copy).
    if (/\bdata-testid\s*=/.test(line)) continue;
    if (/\baria-[a-z]+\s*=/.test(line)) continue;

    // Skip imports / re-exports of the principles file itself.
    if (/from\s+['"][^'"]*gardenPrinciples/.test(line)) continue;

    // ── 1–3. Forbidden wording ────────────────────────────────
    for (const entry of FORBIDDEN_GARDEN_WORDS) {
      try {
        const re = new RegExp(entry.pattern, 'i');
        const m = re.exec(line);
        if (m) {
          violations.push({
            file:      rel,
            line:      i + 1,
            principle: entry.principle,
            tone:      entry.tone,
            match:     m[0],
            snippet:   trimmed.slice(0, 120),
          });
        }
      } catch { /* ignore malformed pattern */ }
    }

    // ── 4. Forbidden visual literals ──────────────────────────
    for (const entry of FORBIDDEN_GARDEN_COLORS) {
      const lit = entry.literal;
      const idx = line.indexOf(lit);
      if (idx !== -1) {
        violations.push({
          file:      rel,
          line:      i + 1,
          principle: 'realism-over-synthetic',
          tone:      'visual',
          match:     lit,
          snippet:   trimmed.slice(0, 120),
          reason:    entry.reason,
        });
      }
    }
  }
}

if (violations.length === 0) {
  console.log('garden-principles: all guarded files clean.');
  console.log(`  scanned ${GARDEN_GUARDED_FILES.length} file(s) against `
    + `${FORBIDDEN_GARDEN_WORDS.length} word rules + `
    + `${FORBIDDEN_GARDEN_COLORS.length} color rules.`);
  process.exit(0);
}

console.error(`garden-principles: ${violations.length} violation(s) found.`);
for (const v of violations) {
  console.error(
    `  ${v.file}:${v.line}  [${v.principle}/${v.tone}]  matches "${v.match}"`
  );
  if (v.reason) console.error(`      reason: ${v.reason}`);
  console.error(`      ${v.snippet}`);
}
console.error('');
console.error('See src/principles/gardenPrinciples.js for the locked rule list.');
console.error('Use softenForGarden() (src/core/scanResultPolicy.js) for tone, ');
console.error('and the unified design tokens (src/design/tokens/colors.js) for color.');
process.exit(1);
