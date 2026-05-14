/**
 * PageHero — calm image-backed hero for every main nav page.
 *
 *   <PageHero
 *     pageKey="tasks"
 *     eyebrow="TODAY"
 *     title="Tasks"
 *     subtitle="Stay on top of what matters most."
 *     chips={[{ label: '2 of 2 done today', tone: 'green' }]}
 *   />
 *
 * Props
 *   pageKey   — short key into pageHeroImages (tasks / sell / scan
 *               etc.). The image is resolved through the canonical
 *               map so a single typo can never produce a broken-
 *               image icon. Optional when `image` is provided.
 *   image     — explicit image URL (caller-supplied photo). When
 *               present, wins over pageKey.
 *   eyebrow   — uppercase label above the title.
 *   title     — required heading.
 *   subtitle  — one-line low-literacy summary.
 *   chips     — array of { label, tone } status chips. First chip
 *               renders as the hero's right-side chip (matches the
 *               existing PremiumPageHero contract); additional
 *               chips fall under the subtitle.
 *   variant   — 'farm' | 'garden'. Drives gradient tint.
 *   testId    — overrides the default data-testid.
 *   children  — optional trailing slot below the subtitle.
 *
 * Design choice
 *   The spec asked for a NEW `PageHero` component, but the
 *   existing `PremiumPageHero` already implements every visual
 *   requirement — rounded card, realistic image background, dark
 *   gradient overlay, large white title, optional chips, mobile-
 *   first, Farroway green/gold accents. Duplicating that markup
 *   would create a second hero system to maintain. Instead this
 *   file is a THIN ADAPTER — it accepts the simplified prop shape
 *   the spec mandates and delegates rendering to PremiumPageHero.
 *
 * Strict-rule audit
 *   * Pure presentational, no localStorage, no network.
 *   * Never throws — guards every input.
 *   * No emoji, no broken-image icons (safe-image fallback).
 *   * Reuses the existing premium token system so colour drift
 *     can never put the hero out of sync with the rest of the
 *     premium surface.
 */

import React from 'react';
import PremiumPageHero from '../premium/PremiumPageHero.jsx';
import { getPageHeroImage } from '../../constants/pageHeroImages.js';
import { safeImage } from '../../utils/safeImage.js';

function _normalizeChips(chips) {
  if (!Array.isArray(chips)) return { primary: null, rest: [] };
  const cleaned = chips
    .filter((c) => c && typeof c === 'object' && typeof c.label === 'string' && c.label.trim())
    .map((c) => ({
      label: c.label.trim(),
      tone:  c.tone === 'green' || c.tone === 'amber' || c.tone === 'neutral'
              ? c.tone : 'neutral',
    }));
  if (cleaned.length === 0) return { primary: null, rest: [] };
  return { primary: cleaned[0], rest: cleaned.slice(1) };
}

const S = {
  extraChipsRow: {
    display:    'flex',
    flexWrap:   'wrap',
    gap:        6,
    marginTop:  10,
  },
  chip: {
    display:        'inline-flex',
    alignItems:     'center',
    padding:        '4px 10px',
    fontSize:       11,
    fontWeight:     700,
    letterSpacing:  '0.02em',
    borderRadius:   999,
    border:         '1px solid rgba(255,255,255,0.22)',
    background:     'rgba(255,255,255,0.08)',
    color:          'rgba(255,255,255,0.92)',
  },
};

export default function PageHero({
  pageKey  = null,
  image    = null,
  eyebrow  = null,
  title,
  subtitle = null,
  chips    = null,
  variant  = 'farm',
  testId   = 'page-hero',
  children = null,
}) {
  if (typeof title !== 'string' || !title.trim()) {
    // Title is the only required prop. Failing soft keeps the
    // host page rendering — empty hero is preferable to a crash.
    return null;
  }
  const resolvedImage = image
    ? safeImage(image)
    : getPageHeroImage(pageKey);
  const mode = variant === 'garden' ? 'garden' : 'farm';
  const { primary, rest } = _normalizeChips(chips);

  return (
    <PremiumPageHero
      mode={mode}
      eyebrow={eyebrow}
      title={title.trim()}
      subtitle={subtitle}
      bgImage={resolvedImage}
      accent={primary ? primary.tone : 'green'}
      chip={primary}
      testId={testId}
    >
      {rest.length > 0 ? (
        <div style={S.extraChipsRow} data-testid={`${testId}-extra-chips`}>
          {rest.map((c) => (
            <span key={c.label} style={S.chip}>{c.label}</span>
          ))}
        </div>
      ) : null}
      {children}
    </PremiumPageHero>
  );
}
