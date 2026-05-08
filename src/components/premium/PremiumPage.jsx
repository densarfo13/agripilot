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
import { PREMIUM_TOKENS as T } from './index.js';

export default function PremiumPage({
  mode = 'farm',
  maxWidth = '32rem',
  bottomPad = '4.5rem',
  className = '',
  style = null,
  testId = null,
  children,
}) {
  const isGarden = mode === 'garden';
  const themeClass = isGarden ? 'ff-theme-garden' : 'ff-theme-farm';
  const bgTop = isGarden ? T.bgGardenTop : T.bgTop;
  const bgBot = isGarden ? T.bgGardenBot : T.bgBottom;

  const pageStyle = {
    minHeight:  '100vh',
    background: `linear-gradient(180deg, ${bgTop} 0%, ${bgBot} 100%)`,
    color:      T.ink,
    padding:    `1.25rem 1rem ${bottomPad}`,
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
