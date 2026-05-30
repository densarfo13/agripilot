/**
 * BloomStageCard.jsx — pure presentational card for flowers,
 * shown INSTEAD of HarvestReadinessCard when the runtime returns
 * category === 'flower'.
 *
 *   <BloomStageCard result={harvestResult} onScanAgain={...} />
 *
 * Strict-rule audit
 *   • Pure presentation. No engine state.
 *   • Safe wording only.
 *   • tStrict for every visible string.
 */

import React from 'react';
import { tStrict } from '../../i18n/strictT.js';

const BLOOM_COPY = {
  budding: {
    label: 'harvest.bloom.budding',
    fallback: 'Budding',
    tone: '#93C5FD',
  },
  blooming: {
    label: 'harvest.bloom.blooming',
    fallback: 'Blooming',
    tone: '#FDE68A',
  },
  peak_bloom: {
    label: 'harvest.bloom.peak',
    fallback: 'Peak bloom',
    tone: '#86EFAC',
  },
  past_bloom: {
    label: 'harvest.bloom.past',
    fallback: 'Past bloom',
    tone: '#FCA5A5',
  },
  unknown: {
    label: 'harvest.bloom.unknown',
    fallback: 'Stage unclear',
    tone: '#9FB3C8',
  },
};

export default function BloomStageCard({ result, onScanAgain }) {
  if (!result || result.category !== 'flower') return null;
  const stage = result.bloomStage || 'unknown';
  const palette = BLOOM_COPY[stage] || BLOOM_COPY.unknown;
  const conf = Math.max(0, Math.min(100, Number(result.confidence) || 0));

  return (
    <article
      data-testid="bloom-stage-card"
      data-bloom-stage={stage}
      style={{
        background: 'rgba(200,148,77,0.08)',
        border: '1px solid rgba(200,148,77,0.28)',
        borderRadius: 14,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        color: '#EAF2FF',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: palette.tone }}>
        {tStrict('harvest.bloom.eyebrow', 'Bloom stage')}
      </div>
      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800,
                   color: '#fff', lineHeight: 1.3 }}>
        {result.plantName}
      </h3>
      <div style={{ fontSize: 14, color: '#EAF2FF', fontWeight: 600 }}>
        {tStrict(palette.label, palette.fallback)}
      </div>
      {result.recommendationBody ? (
        <p style={{ margin: 0, fontSize: 13, color: '#EAF2FF',
                    lineHeight: 1.45 }}>
          {result.recommendationBody}
        </p>
      ) : null}
      {result.estimatedHarvestWindow ? (
        <div style={{ fontSize: 12, color: '#9FB3C8' }}>
          {tStrict('harvest.bloom.window', 'Best cut window:')}{' '}
          <strong style={{ color: '#FDE6C5' }}>{result.estimatedHarvestWindow}</strong>
        </div>
      ) : null}
      {conf > 0 ? (
        <div style={{ fontSize: 11, color: '#9FB3C8', fontWeight: 600 }}>
          {tStrict('harvest.confidence', 'Confidence:')} {conf}%
        </div>
      ) : null}
      {typeof onScanAgain === 'function' ? (
        <button type="button"
                onClick={onScanAgain}
                data-testid="bloom-scan-again"
                style={{ alignSelf: 'flex-start',
                         background: 'transparent', color: '#9FB3C8',
                         border: '1px solid rgba(255,255,255,0.12)',
                         padding: '0.5rem 0.875rem', borderRadius: 10,
                         fontSize: 13, fontWeight: 700, cursor: 'pointer',
                         minHeight: 40 }}>
          {tStrict('harvest.action.scanAgain', 'Scan again')}
        </button>
      ) : null}
    </article>
  );
}
