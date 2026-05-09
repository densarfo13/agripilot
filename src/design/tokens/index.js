/**
 * design/tokens — locked design system tokens (May 2026 visual
 * restraint pass).
 *
 *   import { COLORS, SPACING, TYPE, SHADOWS, RADIUS, MOTION }
 *     from 'src/design/tokens';
 *
 * MODULE MAP
 *   colors      — Soft Ochre palette (locked Apr–May 2026)
 *   spacing     — 4 / 8 / 12 / 16 / 24 / 32 / 48 scale
 *   typography  — hero / section / card / body / secondary / micro
 *   shadows     — sm / card / modal / focus
 *   radius      — sm / md / card / lg / xl / pill
 *   motion      — tap / fade / slide / shimmer
 *
 * RULES
 *   • Components MUST read from these tokens (or the legacy
 *     `src/components/premium/tokens.js` re-export, which now
 *     forwards to this directory).
 *   • Hardcoded hex / px values in component files are a
 *     code-review red flag.
 *   • Every export here is `Object.frozen` so a downstream
 *     consumer can't mutate the shared shape across components.
 */

export { COLORS } from './colors.js';
export { SPACING, gap, pad } from './spacing.js';
export { TYPE } from './typography.js';
export { SHADOWS } from './shadows.js';
export { RADIUS } from './radius.js';
export { MOTION } from './motion.js';
