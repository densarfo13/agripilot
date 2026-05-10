/**
 * ScanComparison — before/after side-by-side recovery view.
 *
 *   <ScanComparison
 *     before={previousEntry}
 *     after={latestEntry}
 *   />
 *
 * Each entry mirrors the scan history shape from
 * `src/lib/scan/scanHistoryStore.js`:
 *   { id, category, noticed, createdAt, experience, taskAdded,
 *     thumbDataUrl?, photoUrl? }
 *
 * Visual:
 *   • Two square thumbnails on the same row (or stacked on narrow screens)
 *   • Status chip per scan + date
 *   • One calm progress note underneath, derived from the
 *     before/after categories (no "guaranteed cure" wording)
 *
 * Strict-rule audit
 *   • Pure presentational. No hooks beyond useStrictTranslation.
 *   • Never throws — defensive defaults for every prop.
 *   • No "guaranteed improvement" / "fixed" / "cured" wording.
 *     Progress notes are descriptive ("looks more stable",
 *     "looks healthier", "still needs review").
 *   • CSS-only fade-in via the existing farroway-fade-in keyframe.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { useStrictTranslation } from '../../i18n/useStrictTranslation.js';

// ─── Category → friendly label key ─────────────────────────────────
const CHIP_KEY_BY_CATEGORY = Object.freeze({
  healthy:                  'gardenMode.scanChip.healthy',
  yellowing:                'gardenMode.scanChip.leafStress',
  holes_or_pest_damage:     'gardenMode.scanChip.pestDamage',
  spots_or_disease_concern: 'gardenMode.scanChip.leafStress',
  wilting:                  'gardenMode.scanChip.leafStress',
  nutrient_stress:          'gardenMode.scanChip.leafStress',
  needs_review:             'gardenMode.scanChip.needsReview',
});
const CHIP_FALLBACK = Object.freeze({
  healthy:                  'Looks healthy',
  yellowing:                'Possible leaf stress',
  holes_or_pest_damage:     'Possible pest damage',
  spots_or_disease_concern: 'Possible leaf stress',
  wilting:                  'Possible leaf stress',
  nutrient_stress:          'Possible leaf stress',
  needs_review:             'Needs review',
});

// ─── Progress-note resolver ────────────────────────────────────────
//
// Maps (before → after) categories to one calm message key. Order
// matters: more specific transitions first, generic fallback last.
// Wording is observational ("looks more stable"), never a claim of
// cure or guaranteed improvement.

function _progressNote(before, after) {
  const b = String(before || '').toLowerCase();
  const a = String(after  || '').toLowerCase();

  if (a === 'healthy' && b && b !== 'healthy') {
    return {
      key: 'scan.compare.note.improvedToHealthy',
      fallback: 'Looking healthier than the previous scan. Steady care may be helping.',
    };
  }
  if (b === a) {
    return {
      key: 'scan.compare.note.steady',
      fallback: 'Condition looks similar to the previous scan. Keep monitoring.',
    };
  }
  if (a === 'needs_review') {
    return {
      key: 'scan.compare.note.unclear',
      fallback: 'Latest scan needs a clearer photo. Try natural light.',
    };
  }
  if (a === 'healthy') {
    return {
      key: 'scan.compare.note.healthy',
      fallback: 'Latest scan looks healthy. Keep the daily check-ins.',
    };
  }
  // Mixed / different categories — calm, descriptive.
  return {
    key: 'scan.compare.note.changed',
    fallback: 'Some things look different. Inspect leaves and continue monitoring.',
  };
}

// ─── Component ────────────────────────────────────────────────────

export default function ScanComparison({
  before = null,
  after  = null,
}) {
  useStrictTranslation();

  // Defensive — render gracefully if either entry is missing.
  if (!before || !after) {
    return (
      <section style={S.empty} data-testid="scan-comparison-empty">
        <p style={S.emptyText}>
          {tSafe('scan.compare.empty',
            'Two scans are needed to show progress. Take another photo to compare.')}
        </p>
      </section>
    );
  }

  const note = _progressNote(before.category, after.category);

  return (
    <section
      style={S.wrap}
      data-testid="scan-comparison"
      data-before-cat={before.category || 'unknown'}
      data-after-cat={after.category || 'unknown'}
    >
      <header style={S.head}>
        <h3 style={S.title}>
          {tSafe('scan.compare.title', 'Compare with last scan')}
        </h3>
      </header>

      <div style={S.row}>
        {/* Before */}
        <article style={S.col} data-testid="scan-comparison-before">
          <span style={S.colLabel}>{tSafe('scan.compare.before', 'Before')}</span>
          <_Thumbnail entry={before} />
          <span style={S.colDate}>{_formatDate(before.createdAt)}</span>
          <span style={S.colChip}>{_chipLabel(before)}</span>
        </article>

        {/* Divider chevron — soft visual anchor between the two cards */}
        <span style={S.chev} aria-hidden="true">→</span>

        {/* After */}
        <article style={S.col} data-testid="scan-comparison-after">
          <span style={S.colLabel}>{tSafe('scan.compare.after', 'After')}</span>
          <_Thumbnail entry={after} />
          <span style={S.colDate}>{_formatDate(after.createdAt)}</span>
          <span style={S.colChip}>{_chipLabel(after)}</span>
        </article>
      </div>

      <p style={S.note} data-testid="scan-comparison-note">
        {tSafe(note.key, note.fallback)}
      </p>

      <p style={S.disclaimer} data-testid="scan-comparison-disclaimer">
        {tSafe('scan.compare.disclaimer',
          'A comparison shows what changed visually — it doesn’t confirm a diagnosis.')}
      </p>
    </section>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────

function _Thumbnail({ entry }) {
  const url = entry?.thumbDataUrl || entry?.photoUrl || null;
  if (url) {
    return (
      <div style={S.thumb}>
        <img
          src={url}
          alt={entry?.noticed || ''}
          style={S.img}
          loading="lazy"
          decoding="async"
          draggable="false"
        />
      </div>
    );
  }
  return (
    <div style={S.thumbEmpty} aria-hidden="true">
      <span style={S.thumbEmoji}>🌿</span>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function _chipLabel(entry) {
  const cat = String(entry?.category || 'needs_review');
  const k = CHIP_KEY_BY_CATEGORY[cat] || CHIP_KEY_BY_CATEGORY.needs_review;
  const fb = CHIP_FALLBACK[cat] || CHIP_FALLBACK.needs_review;
  return tSafe(k, fb);
}

function _formatDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString(); }
  catch { return String(iso).slice(0, 10); }
}

// ─── Styles ───────────────────────────────────────────────────────

const S = {
  wrap: {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.025) 100%)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '0.95rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    boxShadow: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 18px -8px rgba(0,0,0,0.25)',
    animation: 'farroway-fade-in 220ms ease-out both',
  },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: {
    margin: 0,
    fontSize: '0.875rem',
    fontWeight: 700,
    color: '#FFFFFF',
    letterSpacing: '-0.005em',
  },
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },
  col: {
    flex: '1 1 0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0.3rem',
    minWidth: 0,
  },
  colLabel: {
    fontSize: '0.65rem',
    fontWeight: 800,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.5)',
  },
  thumb: {
    width: '100%',
    aspectRatio: '1 / 1',
    borderRadius: '12px',
    overflow: 'hidden',
    background: 'rgba(0,0,0,0.18)',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 1px 0 0 rgba(255,255,255,0.04) inset',
  },
  img: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  thumbEmpty: {
    width: '100%',
    aspectRatio: '1 / 1',
    borderRadius: '12px',
    background: 'linear-gradient(180deg, rgba(200,148,77,0.06) 0%, rgba(53,93,73,0.16) 100%)',
    border: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbEmoji: { fontSize: '2.2rem', lineHeight: 1, opacity: 0.7 },
  colDate: {
    fontSize: '0.7rem',
    color: 'rgba(255,255,255,0.55)',
  },
  colChip: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    padding: '0.2rem 0.5rem',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: 'rgba(255,255,255,0.78)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
  },
  chev: {
    flexShrink: 0,
    alignSelf: 'center',
    fontSize: '1.2rem',
    color: 'rgba(255,255,255,0.45)',
    fontWeight: 700,
    margin: '0 0.05rem',
  },
  note: {
    margin: '0.35rem 0 0',
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 1.5,
  },
  disclaimer: {
    margin: 0,
    fontSize: '0.7rem',
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 1.5,
    fontStyle: 'italic',
  },
  empty: {
    padding: '0.8rem 1rem',
    background: 'rgba(255,255,255,0.03)',
    border: '1px dashed rgba(255,255,255,0.10)',
    borderRadius: '14px',
  },
  emptyText: {
    margin: 0,
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.62)',
    lineHeight: 1.5,
  },
};

export const _internal = Object.freeze({
  CHIP_KEY_BY_CATEGORY,
  CHIP_FALLBACK,
  _progressNote,
  _formatDate,
});
