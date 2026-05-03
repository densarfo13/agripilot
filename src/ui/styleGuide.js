/**
 * styleGuide.js — Farroway UI Style Guide as executable code.
 *
 *   import {
 *     COLORS, TEXT_LIMITS, HIERARCHY, USER_TYPES,
 *     auditCopy, isCompliantUserType,
 *   } from '../ui/styleGuide.js';
 *
 * Why an executable style guide
 * ─────────────────────────────
 *   Style guides as documentation drift the moment a designer
 *   forgets to update a Figma file. Style guides as code stay
 *   honest because they ARE the rules — every consumer reads
 *   the same tokens. New screens reference COLORS.urgent
 *   instead of hardcoding `#EF4444`; copy linters read
 *   TEXT_LIMITS.MAX_INSTRUCTION_WORDS instead of magic numbers.
 *
 *   This module does NOT migrate existing surfaces. Every
 *   currently-shipped component continues to work with its
 *   inline colors / lengths / hierarchies. The tokens become
 *   the path-of-least-resistance for FUTURE code.
 *
 * Spec coverage (Apply Farroway UI Style Guide)
 *   §1 One screen = one action      → enforced in `auditScreen` (TODO)
 *   §2 User type per screen         → USER_TYPES + isCompliantUserType
 *   §3 Mode-aware language          → already shipped via useUserMode
 *   §4 Text length 6–8 words        → TEXT_LIMITS + auditCopy
 *   §5 CTA matches task             → already shipped via CTA_BY_TYPE
 *   §6 Hierarchy                    → HIERARCHY enum
 *   §7 Icons                        → emoji palette in COLORS.icons
 *   §8 Color semantics              → COLORS (good/caution/urgent + neutrals)
 *   §9 Feature visibility per type  → already shipped via featureTier
 *
 * Strict-rule audit
 *   • Pure data + pure functions — never throws.
 *   • SSR-safe (no browser globals).
 *   • Idempotent.
 *   • Backward-compatible — adding a new token is a one-line
 *     change that can never break existing surfaces.
 */

/**
 * §8 COLOR — semantic tokens. Green = good / Yellow = caution /
 * Red = urgent. Neutrals are the shared chrome (ink, dim,
 * background) every surface uses.
 *
 * Existing components inline these hex values; the tokens are
 * here for FUTURE code to reference symbolically instead of
 * re-typing the constants. Keeps the palette honest as a
 * single source of truth.
 */
export const COLORS = Object.freeze({
  // §8 semantic palette
  good:    '#22C55E',     // green — primary success / Done CTA
  goodFg:  '#86EFAC',     // green-foreground (text on green-tint backgrounds)
  goodBg:  'rgba(34,197,94,0.10)',
  goodBd:  'rgba(34,197,94,0.40)',
  caution:    '#F59E0B',  // amber — caution tier ("Do today" urgency)
  cautionFg:  '#FCD34D',
  cautionBg:  'rgba(245,158,11,0.10)',
  cautionBd:  'rgba(245,158,11,0.40)',
  urgent:    '#EF4444',   // red — urgent tier ("Do this now")
  urgentFg:  '#FCA5A5',
  urgentBg:  'rgba(239,68,68,0.10)',
  urgentBd:  'rgba(239,68,68,0.40)',
  // Shared chrome — Farroway dark theme.
  navy:    '#0B1D34',
  navy2:   '#081423',
  ink:     '#EAF2FF',
  inkSoft: 'rgba(255,255,255,0.72)',
  inkDim:  'rgba(255,255,255,0.55)',
  // §7 ICONS — canonical emoji set referenced across surfaces.
  // Including them as palette entries makes "where do these
  // emojis come from?" a single grep-able answer.
  icons: Object.freeze({
    farm:    '\uD83C\uDF3E',  // 🌾 sheaf of grain (parent / farmer mode)
    garden:  '\uD83C\uDF31',  // 🌱 seedling (child / backyard mode)
    scan:    '\uD83D\uDCF7',  // 📷 camera
    voice:   '\uD83D\uDD0A',  // 🔊 speaker
    share:   '\uD83D\uDCE4',  // 📤 outbox
    check:   '\u2714',         // ✔ check mark
  }),
});

/**
 * §5 (Component System) SPACING — 8px grid. Every component
 * uses these tokens for padding / margin / gap so vertical
 * rhythm stays consistent across surfaces. Tokens are numbers
 * (ready to drop into inline styles); CSS layers can wrap
 * them as `${SPACING.md}px` if needed.
 */
export const SPACING = Object.freeze({
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
});

/**
 * §5 (Component System) TYPOGRAPHY — type scale + weights.
 * Pixel sizes (not rem) so they render predictably inside
 * inline-style components. Each entry pairs a size with the
 * weight + line-height it ships with.
 */
export const TYPOGRAPHY = Object.freeze({
  // Eyebrow / micro labels (status pills, section headers).
  eyebrow:  Object.freeze({ size: 11, weight: 700, lineHeight: 1.4, letterSpacing: '0.06em' }),
  // Body / copy.
  body:     Object.freeze({ size: 14, weight: 500, lineHeight: 1.5, letterSpacing: 'normal' }),
  // CTA button labels.
  cta:      Object.freeze({ size: 16, weight: 800, lineHeight: 1.2, letterSpacing: 'normal' }),
  // Headline (FirstActionGate's [Action] — [Consequence] line).
  headline: Object.freeze({ size: 24, weight: 800, lineHeight: 1.20, letterSpacing: '-0.01em' }),
  // Card title (modal headers, ActionCard title).
  title:    Object.freeze({ size: 18, weight: 800, lineHeight: 1.3, letterSpacing: '-0.005em' }),
  // Caption / dim text below body.
  caption:  Object.freeze({ size: 12, weight: 600, lineHeight: 1.4, letterSpacing: 'normal' }),
});

/**
 * §4 TEXT LENGTH — copy length budgets. Caller passes a string
 * to `auditCopy(text, {role})` which counts words and reports
 * whether it falls within the role's budget.
 *
 *   - INSTRUCTION (max 6–8 words): the spec's primary cap.
 *     Applies to action titles, headlines, prompts.
 *   - DETAIL (max 14 words): one-sentence elaborations.
 *   - CTA (max 3 words): button labels.
 */
export const TEXT_LIMITS = Object.freeze({
  MAX_INSTRUCTION_WORDS: 8,
  MAX_DETAIL_WORDS:      14,
  MAX_CTA_WORDS:         3,
  MAX_TOAST_WORDS:       10,
});

/**
 * §6 HIERARCHY — every screen reads top→bottom in this order.
 * The render-order constants below are exported so future
 * components binding to Tailwind / styled-components / inline
 * styles can reference them as a discipline check.
 *
 *   Instruction → Action → Info
 *
 * Concretely on FirstActionGate today:
 *   header (Instruction) → headline (Instruction) → CTA (Action)
 *   → reason / memory / area-insight (Info)
 */
export const HIERARCHY = Object.freeze({
  INSTRUCTION: 'instruction',
  ACTION:      'action',
  INFO:        'info',
});

/**
 * §2 USER TYPE — every screen must declare itself as backyard,
 * farmer, or `'either'`. The `'either'` value is for chrome
 * components that genuinely work without mode adaptation
 * (e.g. login, settings root).
 */
export const USER_TYPES = Object.freeze({
  BACKYARD: 'backyard',
  FARMER:   'farmer',
  EITHER:   'either',
});

/**
 * Pure utility — count words in a string. Trims whitespace,
 * splits on whitespace runs, filters empty. Never throws.
 */
function _wordCount(text) {
  if (typeof text !== 'string' || !text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

/**
 * auditCopy(text, opts?) → { ok: boolean, words: number,
 *                            limit: number, role: string,
 *                            violation: string|null }
 *
 *   const r = auditCopy('Check moisture today', { role: 'instruction' });
 *   if (!r.ok) console.warn(`copy too long: ${r.violation}`);
 *
 * Default role is 'instruction' (the strictest budget). Pass
 * 'detail' / 'cta' / 'toast' for the appropriate cap.
 *
 * Pure + sync; never throws. Used by tests + a future
 * automated linter that walks engine fallbacks to enforce the
 * style guide.
 */
export function auditCopy(text, opts = {}) {
  const role = String((opts && opts.role) || 'instruction').toLowerCase();
  const words = _wordCount(text);
  const limit = (() => {
    if (role === 'detail') return TEXT_LIMITS.MAX_DETAIL_WORDS;
    if (role === 'cta')    return TEXT_LIMITS.MAX_CTA_WORDS;
    if (role === 'toast')  return TEXT_LIMITS.MAX_TOAST_WORDS;
    return TEXT_LIMITS.MAX_INSTRUCTION_WORDS;
  })();
  const ok = words <= limit;
  return {
    ok,
    words,
    limit,
    role,
    violation: ok
      ? null
      : `text exceeds ${role} limit (${words} > ${limit} words)`,
  };
}

/**
 * isCompliantUserType(value) → boolean
 *
 * Lightweight enum guard. A screen's manifest declares its
 * `userType` (one of USER_TYPES); this helper validates the
 * declaration. Used by the screen-audit lint described in
 * the spec §10 acceptance.
 */
export function isCompliantUserType(value) {
  return value === USER_TYPES.BACKYARD
      || value === USER_TYPES.FARMER
      || value === USER_TYPES.EITHER;
}

/**
 * Pure semantic-color resolver. Maps an urgency tier to the
 * canonical color tuple. Spec §8: Green = good / Yellow =
 * caution / Red = urgent.
 *
 *   colorForUrgency('now')   → { fg, bg, bd } using urgent tokens
 *   colorForUrgency('today') → caution tokens
 *   colorForUrgency('week')  → good tokens (default)
 */
export function colorForUrgency(tier) {
  const t = String(tier || '').toLowerCase();
  if (t === 'now')   return { fg: COLORS.urgentFg,  bg: COLORS.urgentBg,  bd: COLORS.urgentBd  };
  if (t === 'today') return { fg: COLORS.cautionFg, bg: COLORS.cautionBg, bd: COLORS.cautionBd };
  return { fg: COLORS.goodFg, bg: COLORS.goodBg, bd: COLORS.goodBd };
}

export const _internal = Object.freeze({ _wordCount });

export default {
  COLORS, SPACING, TYPOGRAPHY, TEXT_LIMITS, HIERARCHY, USER_TYPES,
  auditCopy, isCompliantUserType, colorForUrgency,
};
