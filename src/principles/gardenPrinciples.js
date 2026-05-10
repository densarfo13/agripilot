/**
 * gardenPrinciples — single source of truth for the Garden mode
 *                    experience principles.
 *
 *   import {
 *     GARDEN_PRINCIPLES,
 *     FORBIDDEN_GARDEN_WORDS,
 *     isGardenViolation,
 *   } from 'src/principles/gardenPrinciples.js';
 *
 * What this module is
 * ───────────────────
 * Documentation, machine-checkable rules, and tone helpers in one
 * place. The 10 numbered principles below are the locked spec; the
 * exported arrays are the things a CI guard or runtime check can
 * actually validate against.
 *
 * What this module is NOT
 * ───────────────────────
 *   • Not a feature.
 *   • Not a runtime UI surface — never imports React.
 *   • Not a router for "garden vs farm" — that lives in
 *     `src/hooks/useExperience.js` + `src/hooks/useGrowMode.js`.
 *   • Not the tone substitution itself — `softenForGarden` lives
 *     in `src/core/scanResultPolicy.js`. This file only declares
 *     WHAT counts as a violation; the substitution layer fixes it.
 *
 * Strict-rule audit
 *   • Pure / no I/O / no side effects.
 *   • Frozen exports — callers cannot mutate the principle list.
 *   • Tested by `scripts/ci/check-garden-principles.mjs` running
 *     in `launch-gate:fast`.
 */

// ─── The 10 principles (locked) ───────────────────────────────────

export const GARDEN_PRINCIPLES = Object.freeze([
  Object.freeze({
    id: 'calm-over-complexity',
    n: 1,
    title: 'Calm Over Complexity',
    rule:  'one primary recommendation, one primary action, no dashboard overload.',
  }),
  Object.freeze({
    id: 'continuity-over-novelty',
    n: 2,
    title: 'Continuity Over Novelty',
    rule:  'remember weather, scans, care history, growth, season; the app is aware of its own past.',
  }),
  Object.freeze({
    id: 'timing-over-analytics',
    n: 3,
    title: 'Timing Over Analytics',
    rule:  'intelligence improves WHEN we surface guidance, never produces analytics for the user to read.',
  }),
  Object.freeze({
    id: 'reassurance-over-alarm',
    n: 4,
    title: 'Reassurance Over Alarm',
    rule:  'observational + calm wording. No "high risk", "critical", "urgent", "alarm".',
  }),
  Object.freeze({
    id: 'atmosphere-over-density',
    n: 5,
    title: 'Atmosphere Over Dashboard Density',
    rule:  'cinematic + region-aware + alive. No widget grids, no analytics panels, no admin UI.',
  }),
  Object.freeze({
    id: 'memory-over-data',
    n: 6,
    title: 'Memory Over Raw Data',
    rule:  'growth memories, photo progression, milestones — emotional attachment over numbers.',
  }),
  Object.freeze({
    id: 'guidance-over-overload',
    n: 7,
    title: 'Guidance Over Information Overload',
    rule:  'each screen answers exactly: "what matters right now?" — engine ranks; UI shows top 1.',
  }),
  Object.freeze({
    id: 'realism-over-synthetic',
    n: 8,
    title: 'Realism Over Synthetic UI',
    rule:  'no fake glow, no neon gradients, no cartoon icons in active garden surfaces.',
  }),
  Object.freeze({
    id: 'attachment-over-gamification',
    n: 9,
    title: 'Emotional Attachment Over Gamification',
    rule:  'no badges, points, achievement spam. Quiet progress + milestone memories.',
  }),
  Object.freeze({
    id: 'quiet-intelligence',
    n: 10,
    title: 'Quiet Intelligence Over Visible AI',
    rule:  'never expose model names, confidence percentages, raw scores, "AI confidence" labels.',
  }),
]);

// ─── Forbidden words (machine-checkable) ─────────────────────────
//
// Each entry is a `RegExp` source string + a one-word reason
// pointing at the principle it violates. The CI guard scans
// garden-mode user-facing strings for these patterns.
//
// Keep these regexes word-bounded so they don't collide with
// substrings (e.g. "critical" in "critical-path" comments).
//
// PRINCIPLE TAG — see GARDEN_PRINCIPLES[i].id
//
export const FORBIDDEN_GARDEN_WORDS = Object.freeze([
  // Reassurance Over Alarm (P4) — alarmist user-facing wording
  Object.freeze({ pattern: '\\bhigh risk\\b',           principle: 'reassurance-over-alarm', tone: 'alarm' }),
  Object.freeze({ pattern: '\\bcritical (?:risk|issue|disease|alert)\\b', principle: 'reassurance-over-alarm', tone: 'alarm' }),
  Object.freeze({ pattern: '\\burgent\\b',              principle: 'reassurance-over-alarm', tone: 'alarm' }),
  Object.freeze({ pattern: '\\bsevere damage\\b',       principle: 'reassurance-over-alarm', tone: 'alarm' }),
  Object.freeze({ pattern: '\\bdanger\\b',              principle: 'reassurance-over-alarm', tone: 'alarm' }),
  Object.freeze({ pattern: '\\balarm\\b',               principle: 'reassurance-over-alarm', tone: 'alarm' }),

  // Quiet Intelligence (P10) — never expose model machinery
  Object.freeze({ pattern: '\\bAI confidence\\b',       principle: 'quiet-intelligence', tone: 'jargon' }),
  Object.freeze({ pattern: '\\brisk score\\b',          principle: 'quiet-intelligence', tone: 'jargon' }),
  Object.freeze({ pattern: '\\bconfidence: ?\\d',       principle: 'quiet-intelligence', tone: 'jargon' }),
  Object.freeze({ pattern: '\\bmodel (?:output|score|prediction)\\b', principle: 'quiet-intelligence', tone: 'jargon' }),
  Object.freeze({ pattern: '\\bdetection score\\b',     principle: 'quiet-intelligence', tone: 'jargon' }),

  // Calm Over Complexity (P1) — commercial wording in garden mode
  Object.freeze({ pattern: '\\bharvest ready\\b',       principle: 'calm-over-complexity', tone: 'commercial' }),
  Object.freeze({ pattern: '\\byield\\b',               principle: 'calm-over-complexity', tone: 'commercial' }),
]);

// ─── Forbidden visual literals (style enforcement) ───────────────
//
// These are the legacy color literals that must NOT appear in
// active garden-mode surfaces. The unified design tokens at
// `src/design/tokens/colors.js` cover every legitimate case.
//
export const FORBIDDEN_GARDEN_COLORS = Object.freeze([
  Object.freeze({ literal: '#22C55E', reason: 'neon-green CTA — use ochre #C8944D' }),
  Object.freeze({ literal: '#16A34A', reason: 'neon-green dark — use ochreActive #B9853F' }),
  Object.freeze({ literal: '#0B1D34', reason: 'legacy dark-navy page bg — use beige #F6F1E7' }),
  Object.freeze({ literal: '#062714', reason: 'dark-green button bg — use ochre primary' }),
]);

// ─── Surfaces the CI guard scans ──────────────────────────────────
//
// Active runtime files that are part of the garden experience —
// either rendered exclusively in garden mode, or shared but
// branched on the active mode. The guard scans these against
// FORBIDDEN_GARDEN_WORDS + FORBIDDEN_GARDEN_COLORS.
//
// New garden-mode surfaces should be added here so the guard
// catches drift on day one.
//
export const GARDEN_GUARDED_FILES = Object.freeze([
  // Garden-only surfaces
  'src/pages/JournalPage.jsx',
  'src/pages/SoilScanPage.jsx',         // garden-mode soil flow
  'src/components/system/BackyardGuard.jsx',
  'src/components/plant/PlantEditModal.jsx',
  'src/lib/garden/gardenObservations.js',

  // Shared, mode-branched surfaces (Garden uses the same component
  // as Farm but the wording must still pass the principles).
  'src/pages/MyFarmPage.jsx',           // /my-grow + /my-farm
  'src/pages/PilotHome.jsx',            // /home for both modes
  'src/components/scan/SafeCameraSurface.jsx',

  // Active routes enumerated in the spec route audit. Garden mode
  // users land on each of these via the bottom nav (Tasks /
  // Journal / Scan) or via taps from Home (Support / Funding /
  // Sell — the latter two render BackyardGuard's empty state, but
  // the wrapper itself must still pass the principles).
  'src/pages/AllTasksPage.jsx',         // /tasks
  'src/pages/FarmerProgressPage.jsx',   // /progress
  'src/pages/FundingHub.jsx',           // /funding (BackyardGuard'd in garden)
  'src/pages/Sell.jsx',                 // /sell    (BackyardGuard'd in garden)
  'src/pages/support/SupportCenterPage.jsx',  // /support
  'src/pages/support/SupportFAQPage.jsx',     // /support/faq
  'src/pages/support/SupportContactPage.jsx', // /support/contact
]);

// ─── Helpers ──────────────────────────────────────────────────────

/**
 * Return the FORBIDDEN_GARDEN_WORDS entries that match the supplied
 * text. Used by the CI guard and (if a future runtime surface
 * wants it) by tests. Pure / never throws.
 *
 * @param {string} text  user-facing string
 * @returns {Array<{ pattern, principle, tone, match }>}
 */
export function findGardenViolations(text) {
  if (typeof text !== 'string' || !text) return [];
  const out = [];
  for (const entry of FORBIDDEN_GARDEN_WORDS) {
    try {
      const re = new RegExp(entry.pattern, 'i');
      const m = re.exec(text);
      if (m) {
        out.push({
          pattern:   entry.pattern,
          principle: entry.principle,
          tone:      entry.tone,
          match:     m[0],
        });
      }
    } catch { /* ignore malformed pattern */ }
  }
  return out;
}

/**
 * Tiny convenience — true when the text contains any forbidden
 * garden wording. Useful for assertion-style checks in tests.
 */
export function isGardenViolation(text) {
  return findGardenViolations(text).length > 0;
}

export default Object.freeze({
  GARDEN_PRINCIPLES,
  FORBIDDEN_GARDEN_WORDS,
  FORBIDDEN_GARDEN_COLORS,
  GARDEN_GUARDED_FILES,
  findGardenViolations,
  isGardenViolation,
});
