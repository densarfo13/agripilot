/**
 * PremiumPage — the page-level shell every Farroway page wraps
 * with. Sets the dark green/earth ambient gradient, max-width
 * column, fade-up entry animation, and the optional Farm/Garden
 * theme tint.
 *
 *   <PremiumPage mode="farm" testId="my-farm">
 *     <PremiumPageHero …/>
 *     <PremiumCard>…</PremiumCard>
 *     …
 *   </PremiumPage>
 *
 * Props
 *   mode      — 'farm' | 'garden' (defaults to 'farm'). Drives
 *               the background tint + theme class so child
 *               components can branch via CSS if needed.
 *   maxWidth  — optional inline override; defaults to 32rem to
 *               match Home.
 *   bottomPad — extra bottom padding when the page sits above
 *               the bottom nav. Defaults to 4.5rem.
 *   testId    — data-testid on the wrapper.
 *
 * Strict-rule audit
 *   * Pure presentational. Never throws.
 *   * Inline styles only — zero CSS-module dependency.
 *   * `prefers-reduced-motion` honoured: the fade-up animation
 *     comes from the global `.ff-card-stagger` class which is
 *     already gated by the global stylesheet's reduced-motion
 *     query. We piggy-back on it to keep behaviour consistent.
 */

import React from 'react';
// Wire-up audit (May 2026) — import tokens from the leaf
// `tokens.js` module to avoid a circular dependency with
// `index.js`. See tokens.js header for the full rationale.
import { PREMIUM_TOKENS as T } from './tokens.js';

export default function PremiumPage({
  mode = 'farm',
  maxWidth = '32rem',
  bottomPad = '4.5rem',
  className = '',
  style = null,
  testId = null,
  children,
}) {
  // Wire-up audit (May 2026) — defensive token access. Even
  // though `tokens.js` exports a frozen object, a circular
  // import bug or a future build-tool reordering could surface
  // `T` as undefined here. The `T && T.field` chain plus
  // hard-coded fallbacks guarantee the page renders SOMETHING
  // visible rather than throwing during the first paint.
  const isGarden = String(mode) === 'garden';
  const themeClass = isGarden ? 'ff-theme-garden' : 'ff-theme-farm';
  const bgTop = isGarden ? (T && T.bgGardenTop) || '#0B2421'
                         : (T && T.bgTop)       || '#0B1D34';
  const bgBot = isGarden ? (T && T.bgGardenBot) || '#08231C'
                         : (T && T.bgBottom)    || '#081423';
  const inkColor = (T && T.ink) || '#FFFFFF';

  const pageStyle = {
    minHeight:  '100vh',
    background: `linear-gradient(180deg, ${bgTop} 0%, ${bgBot} 100%)`,
    color:      inkColor,
    // Respect the iPhone safe area (home indicator / notch). env() resolves to 0 on
    // desktop and non-notched devices, so this is a no-op there (desktop unchanged) and
    // only adds the real inset on iOS. Bottom-nav clearance stays in `bottomPad`.
    padding:    `1.25rem 1rem calc(${bottomPad} + env(safe-area-inset-bottom, 0px))`,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    ...(style || {}),
  };

  const shellStyle = {
    maxWidth,
    margin:        '0 auto',
    display:       'flex',
    flexDirection: 'column',
    gap:           '1rem',
  };

  const wrapClass =
    `${themeClass} ff-page premium-page${className ? ' ' + className : ''}`;

  return (
    <div
      className={wrapClass}
      style={pageStyle}
      data-testid={testId || undefined}
      data-mode={isGarden ? 'garden' : 'farm'}
    >
      <div style={shellStyle} className="ff-card-stagger">
        {children}
      </div>
    </div>
  );
}
