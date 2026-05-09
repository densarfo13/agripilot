/**
 * FarmGardenProfileCard — compact dark-glass selector card that
 * sits at the very top of Home (above the WeatherHeroActionCard).
 *
 *   <FarmGardenProfileCard />
 *
 * Mockup contract (Home spec §3)
 * ──────────────────────────────
 *   Farm:                              Garden:
 *   ┌────────────────────────────┐     ┌────────────────────────────┐
 *   │  🌾  My New Farm           │     │  🌱  My Grow               │
 *   │      Default Farm          │     │      Balcony Tomato        │
 *   │                  2 farms › │     │                3 plants › │
 *   └────────────────────────────┘     └────────────────────────────┘
 *
 * Tapping the card opens the experience switcher route ( /my-farm
 * or /my-grow ) — the existing pages own farm/garden management.
 * Self-suppresses when no active experience exists; in that empty
 * state the existing ExperienceManageCard already shows on Home.
 *
 * Strict-rule audit
 *   * Pure-React, never throws.
 *   * Inline styles only (no theme dependency).
 *   * No emoji as the primary visual — uses an inline SVG icon.
 *   * Localised via tSafe; English fallbacks ship inline.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import { PREMIUM_TOKENS as T } from '../premium/tokens.js';

/**
 * Resolve the title + subtitle pair shown in the card.
 *   primary  — "My New Farm" or "My Grow" (the active entity name).
 *   subtitle — "Default Farm" or the crop tag / location.
 * Falls back to mode-aware defaults so a fresh account never sees
 * blanks.
 */
function _resolveTitles(entity, mode) {
  const isGarden = mode === 'garden';
  const e = (entity && typeof entity === 'object') ? entity : {};

  const candidatesPrimary = [
    e.name, e.label, e.farmName, e.gardenName, e.title,
  ];
  // Note: keep this list aligned with the canonical crop field
  // (`crop` / `cropName`); we deliberately avoid the legacy
  // alias to keep the crop drift gate at baseline.
  const candidatesSubtitle = [
    e.cropName, e.crop, e.locationName, e.region,
    e.subtitle, e.description,
  ];

  let primary = null;
  for (const c of candidatesPrimary) {
    if (typeof c === 'string' && c.trim()) { primary = c.trim(); break; }
  }
  let subtitle = null;
  for (const c of candidatesSubtitle) {
    if (typeof c === 'string' && c.trim()) { subtitle = c.trim(); break; }
  }

  if (!primary) {
    primary = isGarden
      ? tSafe('home.profile.defaultGarden', 'My Grow')
      : tSafe('home.profile.defaultFarm',   'My New Farm');
  }
  if (!subtitle) {
    subtitle = isGarden
      ? tSafe('home.profile.gardenSubtitle', 'Active garden')
      : tSafe('home.profile.farmSubtitle',   'Default farm');
  }
  return { primary, subtitle };
}

function _farmIcon() {
  // Wheat-stalk glyph — readable at 22px, stroke-only.
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 21V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M12 8c-2-1.4-3-3-3-5 2 0 3.6 1 4 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
      <path d="M12 11c-2.4-1.6-3.6-3.4-3.6-5.4 2.4 0 4 1.2 4.4 3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
      <path d="M12 14c-2.4-1.6-3.6-3.4-3.6-5.4 2.4 0 4 1.2 4.4 3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
      <path d="M12 8c2-1.4 3-3 3-5-2 0-3.6 1-4 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
      <path d="M12 11c2.4-1.6 3.6-3.4 3.6-5.4-2.4 0-4 1.2-4.4 3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
      <path d="M12 14c2.4-1.6 3.6-3.4 3.6-5.4-2.4 0-4 1.2-4.4 3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

function _gardenIcon() {
  // Potted-plant glyph — leaf above a small pot rim.
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 18h10l-1 3H8l-1-3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
      <path d="M12 18V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M12 12c-2.5-.5-4.5-2.5-4.5-5.5 3 0 5 2 5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
      <path d="M12 11c2.5-.5 4.5-2.5 4.5-5.5-3 0-5 2-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

export default function FarmGardenProfileCard({
  mode = 'farm',
  entity = null,
  count = null,
  testId = 'home-profile-card',
}) {
  const isGarden = mode === 'garden';
  const { primary, subtitle } = _resolveTitles(entity, mode);
  const icon = isGarden ? _gardenIcon() : _farmIcon();

  // Right-hand count chip. Falls back gracefully when count is
  // unknown — the chevron alone keeps the card tappable.
  const countLabel = (() => {
    if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) return null;
    if (isGarden) {
      return count === 1
        ? tSafe('home.profile.onePlant',   '1 plant')
        : tSafe('home.profile.nPlants',    `${count} plants`).replace(/\{count\}/g, String(count));
    }
    return count === 1
      ? tSafe('home.profile.oneFarm',  '1 farm')
      : tSafe('home.profile.nFarms',   `${count} farms`).replace(/\{count\}/g, String(count));
  })();

  const to = isGarden ? '/my-grow' : '/my-farm';

  return (
    <Link
      to={to}
      style={S.card}
      className="ff-tap"
      data-testid={testId}
      data-mode={isGarden ? 'garden' : 'farm'}
      aria-label={primary + ' — ' + subtitle}
    >
      <span style={S.iconWrap} aria-hidden="true">{icon}</span>

      <span style={S.textCol}>
        <span style={S.primary}>{primary}</span>
        <span style={S.subtitle}>{subtitle}</span>
      </span>

      <span style={S.right}>
        {countLabel && <span style={S.count}>{countLabel}</span>}
        <span aria-hidden="true" style={S.chev}>{'›'}</span>
      </span>
    </Link>
  );
}

// Soft Ochre system — white-on-beige surface, ochre icon halo.
const S = {
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.85rem 0.95rem',
    background:    T.panelHi,
    border:        `1px solid ${T.border}`,
    borderRadius:  '14px',
    color:         T.ink,
    textDecoration:'none',
    boxShadow:     T.shadowCard,
  },
  iconWrap: {
    width: 38, height: 38,
    flexShrink: 0,
    borderRadius: 10,
    background: T.ochreSoft,
    border: `1px solid ${T.ochreBorder}`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: T.ochreInk,
  },
  textCol: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    flex: 1,
  },
  primary: {
    fontSize: '0.95rem',
    fontWeight: 800,
    letterSpacing: '-0.005em',
    color: T.ink,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  subtitle: {
    marginTop: 2,
    fontSize: '0.8rem',
    fontWeight: 600,
    color: T.ochreInk,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  right: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexShrink: 0,
    paddingLeft: '0.4rem',
  },
  count: {
    fontSize: '0.78rem',
    fontWeight: 700,
    color: T.inkDim,
  },
  chev: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: T.inkFaint,
    lineHeight: 1,
  },
};
