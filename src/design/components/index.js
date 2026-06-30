/**
 * Farroway Design System — canonical component barrel.
 *
 *   import { CTAButton, HeroCard, SectionCard, EmptyState, ProgressRing, Badge,
 *            KPIChip, SkeletonLoader } from 'src/design/components';
 *
 * Build Once: the existing premium library (PremiumCard / PremiumPageHero /
 * PremiumEmptyState / PremiumStatChip / PremiumSectionTitle) IS the card/hero/
 * empty-state/chip system — this barrel aliases them to the canonical names so
 * every screen imports ONE place. New primitives (CTAButton, ProgressRing,
 * Badge) live alongside. Components still to be built during the per-screen
 * migration (StatusCard, ProgressCard, ActionCard, TimelineCard, FarmCard,
 * WeatherCard, BottomSheet) are intentionally NOT stubbed here — they are added
 * when a real screen consumes them (no speculative/unused exports).
 */

// New canonical primitives (this design-system foundation).
export { default as CTAButton }   from './CTAButton.jsx';
export { default as ProgressRing } from './ProgressRing.jsx';
export { default as Badge }       from './Badge.jsx';

// Canonical aliases over the existing premium library.
export { default as HeroCard }     from '../../components/premium/PremiumPageHero.jsx';
export { default as SectionCard }  from '../../components/premium/PremiumCard.jsx';
export { default as EmptyState }   from '../../components/premium/PremiumEmptyState.jsx';
export { default as KPIChip }      from '../../components/premium/PremiumStatChip.jsx';
export { default as SectionTitle } from '../../components/premium/PremiumSectionTitle.jsx';
export { default as SkeletonLoader } from '../../components/SkeletonLoader.jsx';

// Tokens — single source of truth re-exported for convenience.
export * from '../tokens/index.js';
