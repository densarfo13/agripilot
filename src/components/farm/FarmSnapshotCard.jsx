/**
 * FarmSnapshotCard — calm human-readable summary that replaces
 * the legacy table-feel `Crop / Location / Farm Size / Stage`
 * detail rows on My Farm.
 *
 *   <FarmSnapshotCard
 *     farmName="Pepper Farm"
 *     location="Maryland, United States"
 *     size="100 acres"
 *     stageLabel="Land Prep stage"
 *     weatherInsight="Rain improved moisture this week."  // optional
 *     onManage={() => …}
 *   />
 *
 * Spec contract (May 2026 My Farm refinement)
 *   §1   — living farm identity, NOT a settings page
 *   §7   — replace database-row table with one human snapshot
 *   §11  — single optional weather/memory insight
 *   §14  — emotional ownership tone, no admin chrome
 *
 * Strict-rule audit
 *   • Pure presentational. Never throws.
 *   • Inline styles only. Soft Ochre tokens via PREMIUM_TOKENS.
 *   • All visible text via tSafe with English fallbacks.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { PREMIUM_TOKENS as T } from '../premium/tokens.js';
import { LeafGlyph } from '../icons/InlineGlyphs.jsx';

export default function FarmSnapshotCard({
  farmName,
  location,
  size,
  stageLabel,
  weatherInsight = null,
  onManage = null,
  testId = 'farm-snapshot-card',
}) {
  const cleanName     = (farmName     && String(farmName).trim())     || tSafe('myFarm.unnamedFarm', 'My Farm');
  const cleanLocation = (location     && String(location).trim())     || '';
  const cleanSize     = (size         && String(size).trim())         || '';
  const cleanStage    = (stageLabel   && String(stageLabel).trim())   || '';

  // Compose a single calm meta line: `100 acres • Land Prep stage`
  // Filters out empty halves so a missing field never renders as
  // "  • Land Prep stage" or "100 acres • ".
  const metaLine = [cleanSize, cleanStage].filter(Boolean).join(' • ');

  return (
    <section
      style={S.card}
      data-testid={testId}
    >
      <div style={S.headerRow}>
        <div style={S.textCol}>
          <p style={S.eyebrow}>{tSafe('farm.farmSnapshot', 'Farm snapshot')}</p>
          <h2 style={S.farmName}>{cleanName}</h2>
          {cleanLocation ? (
            <p style={S.location}>
              <span aria-hidden="true" style={S.locPin}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13z"
                        stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinejoin="round"/>
                  <circle cx="12" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.7" fill="none"/>
                </svg>
              </span>
              <span>{cleanLocation}</span>
            </p>
          ) : null}
          {metaLine ? (
            <p style={S.meta}>{metaLine}</p>
          ) : null}
        </div>
      </div>

      {/* Optional weather/memory insight — single calm ochre pill,
          self-suppresses when no signal is provided. */}
      {weatherInsight ? (
        <p style={S.insight} data-testid="farm-snapshot-insight">
          <span aria-hidden="true" style={S.insightEmoji}><LeafGlyph size={14} /></span>
          <span>{weatherInsight}</span>
        </p>
      ) : null}

      {/* Single primary action — opens the management sheet. The
          legacy Edit / Add / Switch buttons stay further down the
          page; this is the calm headline action that signals
          "this is your farm, manage it from here". */}
      {typeof onManage === 'function' ? (
        <button
          type="button"
          onClick={onManage}
          style={S.cta}
          className="ff-tap"
          data-testid="farm-snapshot-manage-cta"
        >
          {tSafe('farm.manageFarm', 'Manage farm')}
          <span aria-hidden="true" style={S.ctaArrow}>{'→'}</span>
        </button>
      ) : null}
    </section>
  );
}

const S = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
    padding: '1.2rem 1.15rem',
    borderRadius: T.radiusCard,
    background: T.panelHi,
    border: `1px solid ${T.border}`,
    boxShadow: T.shadowCard,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.85rem',
  },
  textCol: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    flex: 1,
  },
  eyebrow: {
    margin: 0,
    fontSize: '0.65rem',
    fontWeight: 800,
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    color: T.inkFaint,
  },
  farmName: {
    margin: '0.2rem 0 0',
    fontSize: '1.35rem',
    fontWeight: 800,
    letterSpacing: '-0.01em',
    color: T.ink,
    lineHeight: 1.2,
  },
  location: {
    margin: '0.4rem 0 0',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: T.inkDim,
  },
  locPin: {
    display: 'inline-flex',
    color: T.ochreInk,
  },
  meta: {
    margin: '0.25rem 0 0',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: T.ochreInk,
    letterSpacing: '0.005em',
  },
  insight: {
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
  insightEmoji: {
    fontSize: '0.95rem',
    lineHeight: 1,
    flexShrink: 0,
  },
  cta: {
    alignSelf: 'flex-start',
    marginTop: '0.2rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.78rem 1.3rem',
    borderRadius: 999,
    border: 'none',
    background: 'linear-gradient(180deg, #D4A35F 0%, #B9853F 100%)',
    color: '#FFFFFF',
    fontSize: '0.95rem',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: 46,
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
