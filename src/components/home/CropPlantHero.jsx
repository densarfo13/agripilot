/**
 * CropPlantHero — photographic-style crop/plant image hero at the
 * very top of Home.
 *
 *   ┌────────────────────────────────────────┐
 *   │ [photographic SVG of crop / plant]      │
 *   │                                         │
 *   │   MAIZE                                 │
 *   │   Vegetative stage · Day 12             │
 *   │                                         │
 *   │   My New Farm · Default farm        ›   │
 *   └────────────────────────────────────────┘
 *
 * Pulls its background from `resolveCropImage(crop, mode)` — when
 * a real .webp lands under public/assets/realism/photography/,
 * the manifest's slotPath gate flips ON and we'll swap to the
 * real photo automatically. Until then the SVG composition above
 * stands in.
 *
 * Tap target: the whole card routes to /my-farm (farm mode) or
 * /my-grow (garden mode) so the user can edit the active entity
 * — same destination as the existing compact profile card.
 *
 * Strict-rule audit
 *   • Pure / never throws.
 *   • Self-suppresses nothing — even an empty-state farm gets a
 *     calm "field" or "houseplant" scene so the screen never has
 *     blank top space.
 *   • Lucide-style chevron only — no emoji.
 *   • Soft Ochre / olive ink palette throughout.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import { PREMIUM_TOKENS as T } from '../premium/tokens.js';
import CropImage, { resolveCropImage, normaliseCrop } from '../../assets/realism/cropImages.jsx';

function _resolveTitleLine(entity, crop, mode) {
  const isGarden = String(mode || '').toLowerCase() === 'garden';
  if (crop && typeof crop === 'string' && crop.trim()) {
    // Surface the localised crop label if the i18n pack has it,
    // otherwise capitalise the raw crop string.
    const key = normaliseCrop(crop);
    const fb = key.charAt(0).toUpperCase() + key.slice(1);
    return tSafe(`crops.${key}`, fb);
  }
  if (entity && typeof entity === 'object') {
    const candidates = [entity.name, entity.label, entity.farmName, entity.gardenName, entity.plantName, entity.title];
    for (const c of candidates) if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return isGarden
    ? tSafe('home.hero.emptyGarden', 'Your garden')
    : tSafe('home.hero.emptyFarm',   'Your farm');
}

function _resolveStageLine(entity, crop, mode) {
  const stageRaw = entity && typeof entity === 'object'
    ? String(entity.cropStage || entity.stage || entity.growthStage || '').trim()
    : '';
  const isGarden = String(mode || '').toLowerCase() === 'garden';
  if (stageRaw) {
    const pretty = stageRaw.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return tSafe(`crops.stage.${stageRaw.toLowerCase()}`, pretty);
  }
  if (!crop) {
    return isGarden
      ? tSafe('home.hero.tapToAddPlant', 'Tap to add a plant')
      : tSafe('home.hero.tapToAddFarm',  'Tap to add your farm');
  }
  return isGarden
    ? tSafe('home.hero.gardenWatch', 'Daily care · check moisture')
    : tSafe('home.hero.farmWatch',   'Walking watch · check conditions');
}

function _resolveSubtitleLine(entity, mode) {
  const isGarden = String(mode || '').toLowerCase() === 'garden';
  if (entity && typeof entity === 'object') {
    const candidates = [entity.locationName, entity.region, entity.description, entity.subtitle];
    for (const c of candidates) if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return isGarden
    ? tSafe('home.hero.gardenSubtitle', 'Active garden')
    : tSafe('home.hero.farmSubtitle',   'Default farm');
}

export default function CropPlantHero({
  mode = 'farm',
  entity = null,
  crop = null,
  testId = 'crop-plant-hero',
}) {
  const isGarden = String(mode || '').toLowerCase() === 'garden';
  const to = isGarden ? '/my-grow' : '/my-farm';

  // Pick the crop key with a sensible default: when the user has
  // no crop on file we still want a non-generic image — fall back
  // to a friendly herb scene for garden mode and the generic crop
  // horizon for farm mode. resolveCropImage handles both.
  const resolved = resolveCropImage(crop || (isGarden ? 'herb' : null), mode);
  const titleLine    = _resolveTitleLine(entity, crop, mode);
  const stageLine    = _resolveStageLine(entity, crop, mode);
  const subtitleLine = _resolveSubtitleLine(entity, mode);

  return (
    <Link
      to={to}
      style={S.card}
      data-testid={testId}
      data-mode={isGarden ? 'garden' : 'farm'}
      data-crop={resolved.key}
      aria-label={`${titleLine} — ${subtitleLine}`}
    >
      <CropImage
        crop={crop || (isGarden ? 'herb' : 'crop')}
        mode={mode}
        rounded={0}
        style={S.image}
        testId={`${testId}-image`}
      />
      <div style={S.captionWrap}>
        <div style={S.captionTop}>
          <span style={S.title}>{titleLine}</span>
          <span style={S.stage}>{stageLine}</span>
        </div>
        <div style={S.captionBottom}>
          <span style={S.subtitle}>{subtitleLine}</span>
          <span aria-hidden="true" style={S.chev}>{'›'}</span>
        </div>
      </div>
    </Link>
  );
}

const S = {
  card: {
    position: 'relative',
    display: 'block',
    borderRadius: 18,
    overflow: 'hidden',
    color: '#FFFFFF',
    textDecoration: 'none',
    border: `1px solid ${T.border}`,
    boxShadow: T.shadowCard,
    minHeight: '9.5rem',
  },
  image: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    borderRadius: 0,
  },
  captionWrap: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    padding: '0.95rem 1rem 0.85rem',
    height: '100%',
    minHeight: '9.5rem',
    background: 'linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(15,22,32,0.55) 100%)',
  },
  captionTop: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '0.5rem',
    minWidth: 0,
  },
  title: {
    fontSize: '1.4rem',
    fontWeight: 800,
    letterSpacing: '-0.01em',
    color: '#FFFFFF',
    textShadow: '0 2px 14px rgba(0,0,0,0.45)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  stage: {
    fontSize: '0.78rem',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.85)',
    background: 'rgba(15,22,32,0.45)',
    padding: '0.22rem 0.55rem',
    borderRadius: 999,
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    flexShrink: 0,
    border: '1px solid rgba(255,255,255,0.18)',
  },
  captionBottom: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    marginTop: '0.35rem',
  },
  subtitle: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.85)',
    textShadow: '0 1px 8px rgba(0,0,0,0.35)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  chev: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 1,
    flexShrink: 0,
  },
};
