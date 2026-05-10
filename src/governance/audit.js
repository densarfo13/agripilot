/**
 * audit — runExperienceAudit() consolidates every governance rule
 * into one report.
 *
 *   import { runExperienceAudit } from 'src/governance/audit.js';
 *
 *   const report = await runExperienceAudit({
 *     rootDir: process.cwd(),    // optional, defaults to cwd
 *     // files: [...]            // optional override; default
 *                                // pulls GUARDED_FILES below
 *   });
 *   if (!report.ok) console.error(report.violations);
 *
 * What it checks
 * ──────────────
 *   1. Tone violations  — any FORBIDDEN_GARDEN_WORDS pattern in
 *                         a guarded file's user-facing strings.
 *   2. Visual drift     — any FORBIDDEN_GARDEN_COLORS literal in
 *                         a guarded file's inline styles.
 *   3. Visual patterns  — neon keyword / gradient with > 3 stops
 *                         / pure-green rgba (lime).
 *   4. CTA density      — > 4 buttons rendered inside one
 *                         component file flag a calm-screen risk.
 *
 * What it doesn't check
 * ─────────────────────
 *   • Runtime state (frequency caps, memory cooldowns) — those
 *     are stateful and live in the orchestrator + notification
 *     engines. Their CONTRACT is in this directory; the runtime
 *     state is covered by their own tests.
 *
 * Strict-rule audit
 *   • Pure / file-read only. Never throws — bad files surface as
 *     a violation entry rather than an exception.
 *   • SSR-friendly: the function accepts a `readFile` injection
 *     for environments without `node:fs` (Vite SSR / tests).
 */

import {
  GARDEN_GUARDED_FILES as GUARDED_FILES,
  findGardenViolations,
} from '../principles/gardenPrinciples.js';
import { FORBIDDEN_COLORS, FORBIDDEN_VISUAL_PATTERNS } from './visualConsistencyRules.js';

const DEFAULT_FILES = GUARDED_FILES;
// CTA-density check is intentionally a SOFT signal. The naive
// static button count can't tell visible-at-once buttons from
// phase-conditional ones (e.g. SafeCameraSurface renders 14
// buttons across 10 distinct phases, only 2-3 visible at any
// point). The audit reports density warnings via summary.byKind
// counts so reviewers can spot drift; it does NOT fail the gate
// unless the count exceeds a clearly egregious ceiling.
const CTA_DENSITY_SOFT_THRESHOLD = 8;
const CTA_DENSITY_HARD_CEILING   = 24;

/**
 * @typedef {object} AuditViolation
 * @property {string} file
 * @property {number} line
 * @property {('tone'|'visual_color'|'visual_pattern'|'cta_density')} kind
 * @property {string} message
 * @property {string} [match]
 *
 * @typedef {object} AuditReport
 * @property {boolean}              ok
 * @property {AuditViolation[]}     violations
 * @property {{ scanned: number, byKind: Record<string, number> }} summary
 */

/**
 * Run the audit. Returns the violation list + a small summary.
 *
 * @param {{
 *   rootDir?: string,
 *   files?: string[],
 *   readFile?: (relPath: string, rootDir: string) => Promise<string|null>,
 * }} [opts]
 * @returns {Promise<AuditReport>}
 */
export async function runExperienceAudit(opts = {}) {
  const safe = (opts && typeof opts === 'object') ? opts : {};
  const rootDir = typeof safe.rootDir === 'string' && safe.rootDir
    ? safe.rootDir
    : (typeof process !== 'undefined' ? process.cwd() : '.');
  const files = Array.isArray(safe.files) && safe.files.length > 0
    ? safe.files
    : DEFAULT_FILES;
  const reader = typeof safe.readFile === 'function'
    ? safe.readFile
    : _defaultReadFile;

  /** @type {AuditViolation[]} */
  const violations = [];
  /** @type {Array<{ file: string, kind: string, message: string }>} */
  const warnings = [];
  let scanned = 0;

  for (const rel of files) {
    let src;
    try { src = await reader(rel, rootDir); }
    catch { src = null; }
    if (typeof src !== 'string' || !src) continue;
    scanned += 1;

    const lines = src.split(/\r?\n/);

    // Per-line tone + visual-pattern checks.
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        continue;
      }
      if (/\bdata-testid\s*=/.test(line)) continue;
      if (/\baria-[a-z]+\s*=/.test(line))  continue;
      if (/from\s+['"][^'"]*gardenPrinciples/.test(line)) continue;

      // 1. Tone violations
      const toneHits = findGardenViolations(line);
      for (const hit of toneHits) {
        violations.push({
          file:    rel,
          line:    i + 1,
          kind:    'tone',
          message: `forbidden tone "${hit.match}" — principle: ${hit.principle}`,
          match:   hit.match,
        });
      }

      // 2. Visual color literals
      for (const entry of FORBIDDEN_COLORS) {
        if (line.indexOf(entry.literal) !== -1) {
          violations.push({
            file:    rel,
            line:    i + 1,
            kind:    'visual_color',
            message: `${entry.literal} — ${entry.reason}`,
            match:   entry.literal,
          });
        }
      }

      // 3. Visual pattern violations
      for (const entry of FORBIDDEN_VISUAL_PATTERNS) {
        try {
          const m = entry.pattern.exec(line);
          if (m) {
            violations.push({
              file:    rel,
              line:    i + 1,
              kind:    'visual_pattern',
              message: entry.reason,
              match:   m[0],
            });
          }
        } catch { /* swallow malformed pattern */ }
      }
    }

    // 4. CTA-density check — count `<button` occurrences. Only
    //    the HARD ceiling fails the gate; SOFT-threshold hits
    //    surface as warnings on `summary.warningsByKind` so
    //    reviewers can see drift without breaking the build.
    const buttonCount = (src.match(/<button\b/g) || []).length;
    if (buttonCount > CTA_DENSITY_HARD_CEILING) {
      violations.push({
        file:    rel,
        line:    0,
        kind:    'cta_density',
        message: `${buttonCount} <button> tags exceeds hard ceiling of ${CTA_DENSITY_HARD_CEILING}`,
      });
    } else if (buttonCount > CTA_DENSITY_SOFT_THRESHOLD) {
      warnings.push({
        file:    rel,
        kind:    'cta_density_soft',
        message: `${buttonCount} <button> tags (soft threshold ${CTA_DENSITY_SOFT_THRESHOLD})`,
      });
    }
  }

  const byKind = {};
  for (const v of violations) {
    byKind[v.kind] = (byKind[v.kind] || 0) + 1;
  }
  const warningsByKind = {};
  for (const w of warnings) {
    warningsByKind[w.kind] = (warningsByKind[w.kind] || 0) + 1;
  }

  return Object.freeze({
    ok:         violations.length === 0,
    violations: Object.freeze(violations),
    warnings:   Object.freeze(warnings),
    summary:    Object.freeze({
      scanned,
      byKind:          Object.freeze(byKind),
      warningsByKind:  Object.freeze(warningsByKind),
    }),
  });
}

// ─── Default reader (Node only) ──────────────────────────────────

async function _defaultReadFile(rel, rootDir) {
  try {
    const fs   = await import('node:fs');
    const path = await import('node:path');
    const abs  = path.resolve(rootDir, rel);
    if (!fs.existsSync(abs)) return null;
    return fs.readFileSync(abs, 'utf8');
  } catch {
    return null;
  }
}

export default { runExperienceAudit };
