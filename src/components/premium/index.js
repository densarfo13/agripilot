/**
 * premium/index.js — single import surface for the premium
 * design-system primitives that every Farroway page wraps with.
 *
 * Usage
 *   import {
 *     PremiumPage, PremiumPageHero, PremiumCard,
 *     PremiumSectionTitle, PremiumEmptyState,
 *     PremiumStatChip, PREMIUM_TOKENS,
 *   } from '../components/premium';
 *
 * Each primitive is intentionally small + presentational — they
 * style the chrome, never the data. Pages keep their existing
 * cards/forms/lists; the primitives just give them a consistent
 * dark-green ambient shell, glass cards, and calm typography.
 *
 * Why a single index
 *   Pages already import a lot. Centralising the primitives
 *   keeps each page's import block short + makes a future
 *   tree-shake / theming refactor a one-file change.
 */

// IMPORTANT: tokens are re-exported from the leaf `tokens.js`
// module (NOT defined here) so the primitives below can import
// them without creating a circular dependency. See
// `tokens.js` header for the full rationale + the runtime
// crash signature this layout fixes.
export { PREMIUM_TOKENS } from './tokens.js';

export { default as PremiumPage }         from './PremiumPage.jsx';
export { default as PremiumPageHero }     from './PremiumPageHero.jsx';
export { default as PremiumCard }         from './PremiumCard.jsx';
export { default as PremiumSectionTitle } from './PremiumSectionTitle.jsx';
export { default as PremiumEmptyState }   from './PremiumEmptyState.jsx';
export { default as PremiumStatChip }     from './PremiumStatChip.jsx';
