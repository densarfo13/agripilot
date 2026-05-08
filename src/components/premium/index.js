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

export { default as PremiumPage }         from './PremiumPage.jsx';
export { default as PremiumPageHero }     from './PremiumPageHero.jsx';
export { default as PremiumCard }         from './PremiumCard.jsx';
export { default as PremiumSectionTitle } from './PremiumSectionTitle.jsx';
export { default as PremiumEmptyState }   from './PremiumEmptyState.jsx';
export { default as PremiumStatChip }     from './PremiumStatChip.jsx';

// Shared color / spacing tokens — pages that need to draw a
// custom card or border can reach for these so the visual
// language stays consistent.
export const PREMIUM_TOKENS = Object.freeze({
  bgTop:        '#0B1D34',
  bgBottom:     '#081423',
  bgGardenTop:  '#0B2421',
  bgGardenBot:  '#08231C',
  panel:        'rgba(255,255,255,0.04)',
  panelHi:      'rgba(255,255,255,0.06)',
  border:       'rgba(255,255,255,0.08)',
  borderHi:     'rgba(255,255,255,0.14)',
  ink:          '#FFFFFF',
  inkDim:       'rgba(255,255,255,0.72)',
  inkFaint:     'rgba(255,255,255,0.50)',
  green:        '#22C55E',
  greenSoft:    'rgba(34,197,94,0.10)',
  greenBorder:  'rgba(34,197,94,0.32)',
  greenInk:     '#86EFAC',
  amber:        '#F59E0B',
  amberSoft:    'rgba(245,158,11,0.12)',
  amberBorder:  'rgba(245,158,11,0.32)',
  amberInk:     '#FCD34D',
  radiusCard:   18,
  radiusChip:   999,
  shadowCard:  [
    '0 1px 0 0 rgba(255,255,255,0.04) inset',
    '0 12px 28px -8px rgba(0,0,0,0.30)',
    '0 4px 8px -2px rgba(0,0,0,0.18)',
  ].join(', '),
});
