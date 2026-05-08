/**
 * ShareableCard — premium Garden Mode share card.
 *
 *   <ShareableCard
 *     nickname="Balcony Tomato"
 *     stage="flowering"
 *     emoji="🌼"
 *     caption="Steady care makes a difference."
 *     subtitle="2 weeks of steady care"
 *   />
 *
 * Visual style (spec §6):
 *   • warm cream + sage green palette
 *   • terracotta accent
 *   • soft lighting / subtle gradients
 *   • realistic plant texture (CSS-rendered for now — real photos
 *     drop in later via the same nickname/photo data flow)
 *   • mobile-first 1:1 ratio so screenshots look correct on
 *     Instagram and WhatsApp
 *
 * Strict-rule audit
 *   • Pure presentation. No hooks. No I/O.
 *   • Inline styles only. No CSS-module dependency.
 *   • Never throws — defensive defaults for every prop.
 *   • All visible text via tSafe — see ShareCardModal which
 *     supplies localized strings.
 */

import React from 'react';

// ─── Stage emoji map ─────────────────────────────────────────────
const STAGE_EMOJI = Object.freeze({
  seedling:      '🌱',
  growing:       '🌿',
  vegetative:    '🌿',
  flowering:     '🌼',
  fruiting:      '🍅',
  ready_to_pick: '🌾',
  harvest:       '🌾',
  resting:       '💤',
  dormant:       '💤',
});

function _stageEmoji(stage) {
  const s = String(stage || '').toLowerCase();
  if (!s) return '🌿';
  return STAGE_EMOJI[s] || (
    s.includes('flower')   ? '🌼' :
    s.includes('fruit')    ? '🍅' :
    s.includes('harvest') || s.includes('ready') ? '🌾' :
    s.includes('seed')     ? '🌱' :
    '🌿'
  );
}

// ─── Component ────────────────────────────────────────────────────

export default function ShareableCard({
  nickname    = 'My Plant',
  stage       = 'growing',
  emoji,                       // optional override
  photo       = null,          // dataURL when user has uploaded a plant photo
  caption     = 'Steady care makes a difference.',
  subtitle    = '',
  brandLabel  = 'Farroway',
  size        = 360,           // square px — 360 default fits Instagram square
}) {
  const displayEmoji = (typeof emoji === 'string' && emoji.trim()) ? emoji : _stageEmoji(stage);
  const stageLabel   = String(stage || '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  const hasPhoto     = typeof photo === 'string' && photo.trim().length > 0;

  return (
    <article
      style={{ ...S.card, width: `${size}px`, height: `${size}px` }}
      data-testid="shareable-card"
      data-stage={stage}
      data-has-photo={hasPhoto ? 'true' : 'false'}
    >
      {/* Soft sunlight glow at top-left */}
      <div style={S.glow} aria-hidden="true" />

      {/* Subtle grain noise — adds organic texture without raster cost */}
      <div style={S.grain} aria-hidden="true" />

      {/* Visual anchor — real plant photo when uploaded, otherwise
          the stage emoji. The photo is rendered with object-fit:
          cover so any aspect ratio composes cleanly into the
          square card. A soft top-glow gradient stays above the
          photo for the warm-sunlight feel even on dark images. */}
      <div style={S.heroWrap}>
        {hasPhoto ? (
          <>
            <img
              src={photo}
              alt={nickname || 'My Plant'}
              style={S.heroImg}
              draggable="false"
              loading="lazy"
              decoding="async"
              data-testid="shareable-card-photo"
            />
            <div style={S.heroOverlay} aria-hidden="true" />
          </>
        ) : (
          <span style={S.heroEmoji} aria-hidden="true">{displayEmoji}</span>
        )}
      </div>

      {/* Content block — nickname, stage chip, caption */}
      <div style={S.body}>
        <h2 style={S.nickname}>{nickname || 'My Plant'}</h2>
        {stageLabel ? (
          <span style={S.stageChip}>{stageLabel}</span>
        ) : null}
        <p style={S.caption}>{caption}</p>
        {subtitle ? <p style={S.subtitle}>{subtitle}</p> : null}
      </div>

      {/* Brand strip — terracotta accent line + soft brand label */}
      <div style={S.brandStrip} aria-hidden="true" />
      <p style={S.brand}>{brandLabel}</p>
    </article>
  );
}

// ─── Palette + styles ────────────────────────────────────────────
// Spec §6:  warm cream / sage green / terracotta / soft lighting

const C = {
  cream:      '#F3E8D0',
  creamSoft:  '#E8DEC4',
  sage:       '#355D49',
  sageDeep:   '#234733',
  ink:        '#2A3A2D',
  inkSoft:    '#5C6B5E',
  terracotta: '#C97B45',
  terracottaSoft: '#D6915E',
};

const S = {
  card: {
    position:     'relative',
    overflow:     'hidden',
    borderRadius: '24px',
    background:   `linear-gradient(180deg, ${C.cream} 0%, ${C.creamSoft} 60%, #DDD3B4 100%)`,
    boxShadow:    [
      '0 1px 0 0 rgba(255,255,255,0.6) inset',
      '0 18px 40px -12px rgba(35,71,51,0.32)',
      '0 6px 14px -4px rgba(35,71,51,0.18)',
    ].join(', '),
    fontFamily:   'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    color:        C.ink,
    display:      'flex',
    flexDirection: 'column',
    // 1:1 visual feels right for square social slots; mobile-first.
    aspectRatio:  '1 / 1',
  },
  glow: {
    position: 'absolute',
    top: '-30%', left: '-20%',
    width: '70%', height: '70%',
    background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.55) 0%, transparent 65%)',
    pointerEvents: 'none',
  },
  grain: {
    position: 'absolute', inset: 0,
    backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.18  0 0 0 0 0.20  0 0 0 0 0.16  0 0 0 0.06 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
    backgroundSize: '180px 180px',
    opacity: 0.55,
    mixBlendMode: 'multiply',
    pointerEvents: 'none',
  },
  heroWrap: {
    position: 'relative',
    height: '52%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background:
      `radial-gradient(ellipse 80% 60% at 50% 65%, rgba(53,93,73,0.18) 0%, transparent 70%)`,
  },
  heroEmoji: {
    fontSize: '7rem',
    lineHeight: 1,
    filter: 'drop-shadow(0 6px 12px rgba(35,71,51,0.22))',
    transform: 'translateY(-2%)',
  },
  // Real-photo hero — fills the upper card half. object-fit: cover
  // ensures portrait + landscape uploads both compose cleanly.
  heroImg: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  // Subtle top→bottom warm wash over the photo so the bottom edge
  // blends into the cream body without a hard line. Keeps the
  // sunlight feel consistent on dark photos.
  heroOverlay: {
    position: 'absolute',
    inset: 0,
    background: `linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 35%, rgba(243,232,208,0.18) 92%, ${C.creamSoft} 100%)`,
    pointerEvents: 'none',
  },
  body: {
    flex: '1 1 auto',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    padding: '0.85rem 1.2rem 1.1rem',
    gap: '0.4rem',
    position: 'relative',
  },
  nickname: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 800,
    color: C.sageDeep,
    letterSpacing: '-0.005em',
    lineHeight: 1.2,
    // Defensive — clip if the user picked a 40-char nickname.
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  stageChip: {
    alignSelf: 'flex-start',
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    padding: '0.2rem 0.55rem',
    borderRadius: '999px',
    background: 'rgba(53,93,73,0.10)',
    color: C.sage,
    marginTop: '0.1rem',
  },
  caption: {
    margin: '0.45rem 0 0',
    fontSize: '0.9375rem',
    fontWeight: 500,
    lineHeight: 1.45,
    color: C.ink,
  },
  subtitle: {
    margin: 0,
    fontSize: '0.75rem',
    fontWeight: 500,
    color: C.inkSoft,
    fontStyle: 'italic',
  },
  brandStrip: {
    position: 'absolute',
    left: 0, right: 0, bottom: '34px',
    height: '2px',
    background: `linear-gradient(90deg, transparent 0%, ${C.terracotta} 35%, ${C.terracottaSoft} 65%, transparent 100%)`,
    opacity: 0.65,
  },
  brand: {
    position: 'absolute',
    right: '1.1rem', bottom: '0.55rem',
    margin: 0,
    fontSize: '0.7rem',
    fontWeight: 800,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: C.terracotta,
  },
};

export const _internal = Object.freeze({
  STAGE_EMOJI,
  _stageEmoji,
  C,
});
