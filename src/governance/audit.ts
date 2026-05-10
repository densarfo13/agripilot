/**
 * audit — runExperienceAudit() consolidates every governance rule
 * into one report.
 *
 *   import { runExperienceAudit } from 'src/governance/audit';
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
 *   3. Visual patterns  — neon keyword / pure-green rgba (lime).
 *   4. Gradient stops   — any linear-gradient(...) with > 3
 *                         color stops (parens-aware so nested
 *                         rgba(...) doesn't false-positive).
 *   5. CTA density      — > 24 buttons in one file = hard fail;
 *                         > 8 = soft warning surfaced separately
 *                         on `report.warnings`.
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
import {
  FORBIDDEN_COLORS,
  FORBIDDEN_VISUAL_PATTERNS,
  findGradientStopViolations,
  MAX_GRADIENT_STOPS,
} from './visualConsistencyRules.js';

const DEFAULT_FILES: ReadonlyArray<string> = GUARDED_FILES;
const CTA_DENSITY_SOFT_THRESHOLD = 8;
const CTA_DENSITY_HARD_CEILING   = 24;

export type AuditViolationKind =
  | 'tone'
  | 'visual_color'
  | 'visual_pattern'
  | 'gradient_stops'
  | 'cta_density';

export interface AuditViolation {
  readonly file: string;
  readonly line: number;
  readonly kind: AuditViolationKind;
  readonly message: string;
  readonly match?: string;
}

export interface AuditWarning {
  readonly file: string;
  readonly kind: string;
  readonly message: string;
}

export interface AuditReport {
  readonly ok: boolean;
  readonly violations: ReadonlyArray<AuditViolation>;
  readonly warnings: ReadonlyArray<AuditWarning>;
  readonly summary: {
    readonly scanned: number;
    readonly byKind: Readonly<Record<string, number>>;
    readonly warningsByKind: Readonly<Record<string, number>>;
  };
}

export interface AuditOptions {
  readonly rootDir?: string;
  readonly files?: ReadonlyArray<string>;
  readonly readFile?: (relPath: string, rootDir: string) => Promise<string | null>;
}

/**
 * Run the audit. Returns the violation list + a small summary.
 */
export async function runExperienceAudit(opts: AuditOptions = {}): Promise<AuditReport> {
  const safe: AuditOptions = (opts && typeof opts === 'object') ? opts : {};
  const rootDir = typeof safe.rootDir === 'string' && safe.rootDir
    ? safe.rootDir
    : (typeof process !== 'undefined' ? process.cwd() : '.');
  const files = Array.isArray(safe.files) && safe.files.length > 0
    ? safe.files
    : DEFAULT_FILES;
  const reader = typeof safe.readFile === 'function'
    ? safe.readFile
    : _defaultReadFile;

  const violations: AuditViolation[] = [];
  const warnings:   AuditWarning[]   = [];
  let scanned = 0;

  for (const rel of files) {
    let src: string | null;
    try { src = await reader(rel, rootDir); }
    catch { src = null; }
    if (typeof src !== 'string' || !src) continue;
    scanned += 1;

    const lines = src.split(/\r?\n/);

    // Per-line tone + visual-pattern + color checks.
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
      const toneHits = findGardenViolations(line) as ReadonlyArray<{ match: string; principle: string }>;
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

    // 4. Gradient stops — parens-aware whole-file scan. Catches
    //    real `linear-gradient(...)` calls with > MAX_GRADIENT_STOPS
    //    color stops; nested rgba() commas are correctly ignored.
    const gradientHits = findGradientStopViolations(src);
    for (const g of gradientHits) {
      violations.push({
        file:    rel,
        line:    _findFirstMatchLine(lines, g.excerpt.slice(0, 30)),
        kind:    'gradient_stops',
        message: `gradient with ${g.stops} stops exceeds limit of ${MAX_GRADIENT_STOPS}`,
        match:   g.excerpt,
      });
    }

    // 5. CTA-density check
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

  const byKind: Record<string, number> = {};
  for (const v of violations) {
    byKind[v.kind] = (byKind[v.kind] || 0) + 1;
  }
  const warningsByKind: Record<string, number> = {};
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

// ─── Internals ───────────────────────────────────────────────────

function _findFirstMatchLine(lines: string[], needle: string): number {
  if (!needle) return 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(needle)) return i + 1;
  }
  return 0;
}

async function _defaultReadFile(rel: string, rootDir: string): Promise<string | null> {
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
