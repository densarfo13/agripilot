/**
 * PremiumPageHero — top-of-page hero band with realistic
 * background imagery, eyebrow label, large title, and an optional
 * subtitle line. Replaces the "page icon + plain heading" pattern
 * across Farm / Grow / Progress / Tasks / Scan / Sell / Funding.
 *
 *   <PremiumPageHero
 *     eyebrow="My Farm"
 *     title="Tomatoes"
 *     subtitle="Flowering stage — moisture stable"
 *     bgImage="/images/garden/flowering-field.svg"
 *     mode="farm"
 *     accent="green"
 *   />
 *
 * Props
 *   eyebrow   — short uppercase label above the title (optional).
 *   title     — required. The main heading.
 *   subtitle  — optional one-line context sentence.
 *   chip      — optional right-side status chip { label, tone }
 *               where tone is 'green' | 'amber' | 'neutral'.
 *   bgImage   — relative URL to a /images/* asset. Falls back to
 *               a calm gradient if the image 404s.
 *   mode      — 'farm' | 'garden'. Tints the gradient overlay.
 *   accent    — green | amber | neutral (only changes the eyebrow
 *               + chip color).
 *   children  — optional trailing slot for an action button or
 *               link. Sits below the subtitle.
 *
 * Strict-rule audit
 *   * Pure presentational. Never throws.
 *   * No emoji as primary visual — uses the realistic background.
 *   * Inline styles only.
 *   * Background image rendered via background-image so React
 *     never has to handle an <img> 404 — the underlying gradient
 *     stays visible no matter what.
 */

import React from 'react';
import { PREMIUM_TOKENS as T } from './index.js';

const ACCENT = {
  green:   { ink: T.greenInk, soft: T.greenSoft, border: T.greenBorder },
  amber:   { ink: T.amberInk, soft: T.amberSoft, border: T.amberBorder },
  neutral: { ink: T.inkDim,   soft: T.panelHi,   border: T.borderHi },
};

const FALLBACK_BG = '/images/weather/default-field.svg';

export default function PremiumPageHero({
  eyebrow = null,
  title,
  subtitle = null,
  chip = null,
  bgImage = FALLBACK_BG,
  mode = 'farm',
  accent = 'green',
  testId = 'premium-page-hero',
  children = null,
}) {
  const a = ACCENT[accent] || ACCENT.green;
  const isGarden = mode === 'garden';

  // Stack: vertical dark gradient ON TOP of the image so text
  // stays legible regardless of underlying photo. Garden mode
  // gets a slightly warmer tint at the top so the card reads
  // as nurturing rather than operational.
  const gardenTopTint =
    'linear-gradient(180deg, rgba(8,28,22,0.55) 0%, rgba(8,28,22,0.78) 65%, rgba(8,28,22,0.92) 100%)';
  const farmTopTint =
    'linear-gradient(180deg, rgba(8,18,28,0.55) 0%, rgba(8,18,28,0.78) 65%, rgba(8,18,28,0.92) 100%)';

  const bgStyle = {
    backgroundImage: [
      isGarden ? gardenTopTint : farmTopTint,
      `url(${bgImage})`,
    ].join(', '),
    backgroundSize:     'cover',
    backgroundPosition: 'center',
  };

  return (
    <section
      className="premium-page-hero"
      data-testid={testId}
      data-mode={isGarden ? 'garden' : 'farm'}
      style={{ ...S.hero, ...bgStyle }}
    >
      {/* Top row: eyebrow + optional chip */}
      <div style={S.topRow}>
        {eyebrow && (
          <span
            style={{
              ...S.eyebrow,
              color: a.ink,
              background: a.soft,
              border: `1px solid ${a.border}`,
            }}
          >
            {eyebrow}
          </span>
        )}
        {chip && (
          <span
            style={{
              ...S.chip,
              color: ACCENT[chip.tone || 'neutral'].ink,
              background: ACCENT[chip.tone || 'neutral'].soft,
              border: `1px solid ${ACCENT[chip.tone || 'neutral'].border}`,
            }}
          >
            {chip.label}
          </span>
        )}
      </div>

      {/* Title + subtitle */}
      <h1 style={S.title}>{title}</h1>
      {subtitle && <p style={S.subtitle}>{subtitle}</p>}

      {/* Optional trailing slot — typically a button */}
      {children && <div style={S.actionRow}>{children}</div>}
    </section>
  );
}

const S = {
  hero: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    minHeight: '8.5rem',
    padding: '1.05rem 1.1rem 1.15rem',
    borderRadius: 18,
    color: 'rgba(255,255,255,0.96)',
    overflow: 'hidden',
    border: `1px solid ${T.border}`,
    boxShadow: T.shadowCard,
  },
  topRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.5rem',
    minHeight: '1.5rem',
  },
  eyebrow: {
    display: 'inline-flex',
    padding: '0.3rem 0.65rem',
    borderRadius: 999,
    fontSize: '0.7rem',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  chip: {
    display: 'inline-flex',
    padding: '0.3rem 0.65rem',
    borderRadius: 999,
    fontSize: '0.72rem',
    fontWeight: 700,
  },
  title: {
    margin: '0.4rem 0 0',
    fontSize: '1.6rem',
    fontWeight: 800,
    letterSpacing: '-0.018em',
    lineHeight: 1.15,
  },
  subtitle: {
    margin: '0.2rem 0 0',
    fontSize: '0.95rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 1.45,
  },
  actionRow: {
    marginTop: '0.65rem',
  },
};
