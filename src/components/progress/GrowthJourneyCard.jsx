/**
 * GrowthJourneyCard — single unified Progress surface that
 * replaces the fragmented stat / bar / insight / momentum /
 * economics card stack with one calm visual journey.
 *
 *   <GrowthJourneyCard
 *     mode="farm"
 *     cropLabel="Pepper"
 *     stageKey="early_growth"
 *     completedToday={2}
 *     totalToday={5}
 *     nextActionTitle="Inspect lower leaves tomorrow morning."
 *     nextActionMinutes={2}
 *     onStartCheck={() => navigate('/tasks')}
 *     memoryMoment={{ key, fallback, emoji }}    // optional
 *   />
 *
 * Spec contract (May 2026 Progress refinement)
 *   §1 — no 0/100 score, no productivity-dashboard feel
 *   §2 — supportive language only, no "Needs attention"
 *   §3 — no competitive comparison
 *   §4 — ONE unified card (not five disconnected blocks)
 *   §5 — visual hero with stage glyph + label
 *   §7 — visual growth timeline (seedling → early growth →
 *        flowering → harvest), current stage highlighted
 *   §8 — one optional memory moment, never a history dashboard
 *   §9 — one next-best action
 *   §10 — one supportive insight line
 *   §11 — Farm vs Garden differentiation in copy
 *
 * Strict-rule audit
 *   • Pure presentational. Never throws.
 *   • All visible text via tSafe; defensive English fallbacks.
 *   • Inline styles only — Soft Ochre tokens only.
 *   • CSS-only animations; respects prefers-reduced-motion via
 *     the global ff-tap class on the CTA.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { PREMIUM_TOKENS as T } from '../premium/tokens.js';

// ── Stage glyphs (inline SVG, no asset dependency) ────────────
function _seedlingGlyph(active) {
  const stroke = active ? '#3F6A3F' : '#BFA98A';
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 28 L16 16" stroke={stroke} strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 18 C 8 14, 8 8, 14 6 C 16 10, 16 14, 16 18 Z"
            fill={active ? 'rgba(94,142,94,0.32)' : 'rgba(191,169,138,0.20)'}
            stroke={stroke} strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M22 26 q -3 0 -6 -2 q 6 -1 6 2 z" fill={active ? '#5E8E5E' : '#BFA98A'}/>
    </svg>
  );
}
function _earlyGrowthGlyph(active) {
  const stroke = active ? '#3F6A3F' : '#BFA98A';
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 30 L16 12" stroke={stroke} strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 22 C 6 18, 4 8, 12 4 C 16 10, 16 16, 16 22 Z"
            fill={active ? 'rgba(94,142,94,0.40)' : 'rgba(191,169,138,0.20)'}
            stroke={stroke} strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M16 18 C 26 14, 28 4, 20 0 C 16 6, 16 12, 16 18 Z"
            fill={active ? 'rgba(94,142,94,0.30)' : 'rgba(191,169,138,0.16)'}
            stroke={stroke} strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  );
}
function _floweringGlyph(active) {
  const stroke = active ? '#3F6A3F' : '#BFA98A';
  const flower = active ? '#D4A35F' : '#BFA98A';
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 30 L16 14" stroke={stroke} strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 22 C 6 18, 6 10, 12 6 C 16 12, 16 18, 16 22 Z"
            fill={active ? 'rgba(94,142,94,0.34)' : 'rgba(191,169,138,0.18)'}
            stroke={stroke} strokeWidth="1.4" strokeLinejoin="round"/>
      <circle cx="16" cy="9" r="4" fill={flower} opacity="0.85"/>
      <circle cx="11" cy="11" r="2.4" fill={flower} opacity="0.7"/>
      <circle cx="21" cy="11" r="2.4" fill={flower} opacity="0.7"/>
      <circle cx="16" cy="9" r="1.4" fill={active ? '#7A5A28' : '#7A5A28'} opacity="0.9"/>
    </svg>
  );
}
function _harvestGlyph(active) {
  const stroke = active ? '#3F6A3F' : '#BFA98A';
  const fruit = active ? '#D4A35F' : '#BFA98A';
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 30 L16 16" stroke={stroke} strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 22 C 6 18, 6 10, 12 6 C 16 12, 16 18, 16 22 Z"
            fill={active ? 'rgba(94,142,94,0.34)' : 'rgba(191,169,138,0.18)'}
            stroke={stroke} strokeWidth="1.4" strokeLinejoin="round"/>
      <ellipse cx="11"  cy="14" rx="3" ry="4.2" fill={fruit} opacity="0.85"/>
      <ellipse cx="21"  cy="14" rx="3" ry="4.2" fill={fruit} opacity="0.85"/>
      <ellipse cx="16"  cy="11" rx="3" ry="4"   fill={fruit}/>
    </svg>
  );
}

const STAGES = [
  { key: 'seeded',         glyph: _seedlingGlyph,
    labelKey: 'progress.stage.seeded',         labelFb: 'Seeded' },
  { key: 'early_growth',   glyph: _earlyGrowthGlyph,
    labelKey: 'progress.earlyGrowth',          labelFb: 'Early growth' },
  { key: 'flowering',      glyph: _floweringGlyph,
    labelKey: 'progress.floweringStage',       labelFb: 'Flowering' },
  { key: 'harvest_ready',  glyph: _harvestGlyph,
    labelKey: 'progress.harvestApproaching',   labelFb: 'Harvest ready' },
];

// Map the wider engine stage vocabulary to our four-step ladder.
function _resolveStageIndex(stageKey) {
  if (typeof stageKey !== 'string') return 1;
  const k = stageKey.toLowerCase();
  if (k.includes('seed'))                         return 0;
  if (k.includes('early') || k.includes('veg'))   return 1;
  if (k.includes('flower') || k.includes('bloom')) return 2;
  if (k.includes('harvest') || k.includes('ripe') || k.includes('mature')) return 3;
  return 1;
}

export default function GrowthJourneyCard({
  mode = 'farm',
  cropLabel = '',
  stageKey = 'early_growth',
  completedToday = 0,
  totalToday = 0,
  nextActionTitle = '',
  nextActionMinutes = 2,
  onStartCheck = null,
  memoryMoment = null,
  testId = 'growth-journey-card',
}) {
  const stageIdx = _resolveStageIndex(stageKey);
  const current = STAGES[stageIdx] || STAGES[1];
  const isGarden = mode === 'garden';

  const stageLabel = tSafe(current.labelKey, current.labelFb);

  // Progress sentence — natural language, no scoring.
  const progressLine = (() => {
    if (completedToday >= 2) {
      return tSafe(
        'progress.tasksCompletedToday',
        `${completedToday} tasks completed today`,
      ).replace('{count}', String(completedToday));
    }
    if (completedToday === 1) {
      return tSafe('progress.oneTaskCompletedToday', '1 task completed today');
    }
    if (totalToday > 0) {
      return tSafe('progress.updatedThisMorning', 'Updated this morning');
    }
    return tSafe('progress.checkedRecently', 'Checked recently');
  })();

  // Insight — supportive, never score-based.
  const insightLine = isGarden
    ? tSafe('progress.gardenInsight', 'Your plants are responding well.')
    : tSafe('progress.farmInsight',   'Your farm is building steady momentum.');

  return (
    <section
      style={S.card}
      data-testid={testId}
      data-mode={isGarden ? 'garden' : 'farm'}
      data-stage={current.key}
    >
      {/* Hero band: large active glyph + crop label + stage */}
      <div style={S.heroRow}>
        <span style={S.heroGlyphWrap} aria-hidden="true">
          {current.glyph(true)}
        </span>
        <div style={S.heroText}>
          {cropLabel ? (
            <p style={S.heroCrop}>{cropLabel}</p>
          ) : null}
          <h2 style={S.heroStage}>{stageLabel}</h2>
          <p style={S.heroProgress}>{progressLine}</p>
        </div>
      </div>

      {/* Visual timeline — four soft glyphs with the active one
          highlighted. Replaces the legacy 9-dot status row. */}
      <div style={S.timelineRow} role="list" aria-label={tSafe('progress.timelineAria', 'Growth journey')}>
        {STAGES.map((stg, i) => {
          const active = i === stageIdx;
          const past   = i < stageIdx;
          return (
            <div
              key={stg.key}
              role="listitem"
              style={{
                ...S.timelineItem,
                opacity: active ? 1 : past ? 0.78 : 0.45,
              }}
              data-active={active ? 'true' : 'false'}
            >
              <span style={{
                ...S.timelineGlyph,
                borderColor: active ? T.greenBorder : T.border,
                background: active ? T.greenSoft   : T.panelHi,
                boxShadow:  active ? '0 0 0 4px rgba(94,142,94,0.10)' : 'none',
              }}>
                {stg.glyph(active || past)}
              </span>
              <span style={{
                ...S.timelineLabel,
                color: active ? T.greenInk : T.inkDim,
                fontWeight: active ? 800 : 600,
              }}>
                {tSafe(stg.labelKey, stg.labelFb)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Memory moment — single optional line. Reuses the same
          envelope shape MemoryMomentLine produces. */}
      {memoryMoment && memoryMoment.fallback ? (
        <p style={S.memoryLine} data-testid="growth-journey-memory">
          <span aria-hidden="true" style={S.memoryEmoji}>
            {memoryMoment.emoji || '🌿'}
          </span>
          <span>{tSafe(memoryMoment.key, memoryMoment.fallback)}</span>
        </p>
      ) : null}

      {/* Supportive insight — one calm sentence. */}
      <p style={S.insightLine}>{insightLine}</p>

      {/* Next-best action — single primary CTA. */}
      {nextActionTitle ? (
        <div style={S.nextBlock}>
          <p style={S.nextLabel}>
            {tSafe('progress.nextRecommendedCheck', 'Next recommended check')}
          </p>
          <p style={S.nextTitle}>{nextActionTitle}</p>
          {Number.isFinite(nextActionMinutes) && nextActionMinutes > 0 ? (
            <p style={S.nextMeta}>
              {`${nextActionMinutes} ${tSafe('common.min', 'min')}`}
            </p>
          ) : null}
          {typeof onStartCheck === 'function' ? (
            <button
              type="button"
              onClick={onStartCheck}
              style={S.cta}
              className="ff-tap"
              data-testid="growth-journey-cta"
            >
              {tSafe('progress.startCheck', 'Start check')}
              <span aria-hidden="true" style={S.ctaArrow}>{'→'}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

const S = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    padding: '1.25rem 1.15rem',
    borderRadius: T.radiusCard,
    background: T.panelHi,
    border: `1px solid ${T.border}`,
    boxShadow: T.shadowCard,
  },
  heroRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.85rem',
  },
  heroGlyphWrap: {
    width: 56, height: 56,
    flexShrink: 0,
    borderRadius: 16,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: T.greenSoft,
    border: `1px solid ${T.greenBorder}`,
    boxShadow: '0 0 0 4px rgba(94,142,94,0.06)',
  },
  heroText: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    flex: 1,
  },
  heroCrop: {
    margin: 0,
    fontSize: '0.7rem',
    fontWeight: 800,
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    color: T.inkFaint,
  },
  heroStage: {
    margin: '0.15rem 0 0',
    fontSize: '1.25rem',
    fontWeight: 800,
    letterSpacing: '-0.005em',
    color: T.ink,
  },
  heroProgress: {
    margin: '0.2rem 0 0',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: T.inkDim,
  },
  timelineRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '0.5rem',
    paddingTop: '0.4rem',
    borderTop: `1px solid ${T.border}`,
  },
  timelineItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.4rem',
    transition: 'opacity 240ms ease-out',
  },
  timelineGlyph: {
    width: 44, height: 44,
    borderRadius: '50%',
    border: `1px solid ${T.border}`,
    background: T.panelHi,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLabel: {
    fontSize: '0.7rem',
    letterSpacing: '0.02em',
    textAlign: 'center',
    lineHeight: 1.2,
  },
  memoryLine: {
    margin: 0,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.55rem',
    padding: '0.55rem 0.8rem',
    borderRadius: 999,
    background: T.ochreSoft,
    border: `1px solid ${T.ochreBorder}`,
    color: T.ochreInk,
    fontSize: '0.85rem',
    fontWeight: 600,
    alignSelf: 'flex-start',
    lineHeight: 1.4,
  },
  memoryEmoji: {
    fontSize: '0.95rem',
    lineHeight: 1,
    flexShrink: 0,
  },
  insightLine: {
    margin: 0,
    fontSize: '0.875rem',
    fontWeight: 600,
    color: T.greenInk,
    lineHeight: 1.5,
    paddingLeft: '0.2rem',
  },
  nextBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    padding: '0.85rem 0.95rem',
    background: 'rgba(212,163,95,0.08)',
    border: `1px solid ${T.ochreBorder}`,
    borderRadius: 14,
  },
  nextLabel: {
    margin: 0,
    fontSize: '0.65rem',
    fontWeight: 800,
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    color: T.inkFaint,
  },
  nextTitle: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 700,
    color: T.ink,
    lineHeight: 1.4,
  },
  nextMeta: {
    margin: 0,
    fontSize: '0.78rem',
    fontWeight: 700,
    color: T.ochreInk,
  },
  cta: {
    alignSelf: 'flex-start',
    marginTop: '0.4rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.78rem 1.3rem',
    borderRadius: 999,
    border: 'none',
    background: 'linear-gradient(180deg, #D4A35F 0%, #B9853F 100%)',
    color: '#FFFFFF',
    fontSize: '0.9375rem',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: 44,
    boxShadow: '0 10px 24px rgba(185,133,63,0.32)',
    fontFamily: 'inherit',
    letterSpacing: '0.005em',
  },
  ctaArrow: {
    fontSize: '1.05rem',
    fontWeight: 800,
    lineHeight: 1,
  },
};
