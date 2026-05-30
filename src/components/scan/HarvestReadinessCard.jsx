/**
 * HarvestReadinessCard.jsx — pure presentational card consuming
 * the HarvestReadinessResult envelope returned by the runtime.
 *
 *   <HarvestReadinessCard
 *      result={harvestResult}
 *      onCreateHarvestTask={...}   // canonical Task Runtime call-site
 *      onScanAgain={...}
 *   />
 *
 * Rules
 *   • DO NOT calculate ripeness here. The runtime owns the math.
 *   • DO NOT use banned wording. The CI gate enforces this.
 *   • DO NOT write tasks directly — call the parent's handler.
 *   • Gated by the parent on
 *       result.category !== 'unknown' && !result.needsReview-only
 *     (we DO show the card on needsReview to surface
 *     "needs another look" — but the parent must check
 *     isSupportedPlant on the plant id before mounting).
 *
 * Strict-rule audit
 *   • Pure presentation. No engine state, no localStorage.
 *   • Safe wording only.
 *   • tStrict for every visible string.
 */

import React from 'react';
import { tStrict } from '../../i18n/strictT.js';

const STATUS_COPY = {
  ready: {
    headlineKey:    'harvest.headline.ready',
    headlineFallback: 'Likely ready to harvest',
    toneColor:      '#86EFAC',
    bg:             'rgba(34,197,94,0.10)',
    border:         'rgba(34,197,94,0.32)',
  },
  almost_ready: {
    headlineKey:    'harvest.headline.almost',
    headlineFallback: 'Appears almost ready',
    toneColor:      '#FDE68A',
    bg:             'rgba(245,158,11,0.10)',
    border:         'rgba(245,158,11,0.32)',
  },
  not_ready: {
    headlineKey:    'harvest.headline.notReady',
    headlineFallback: 'Not ready yet',
    toneColor:      '#93C5FD',
    bg:             'rgba(14,165,233,0.10)',
    border:         'rgba(14,165,233,0.32)',
  },
  overripe: {
    headlineKey:    'harvest.headline.needsLook',
    headlineFallback: 'Needs another look',
    toneColor:      '#FCA5A5',
    bg:             'rgba(239,68,68,0.10)',
    border:         'rgba(239,68,68,0.32)',
  },
  unknown: {
    headlineKey:    'harvest.headline.unclear',
    headlineFallback: 'Readiness unclear',
    toneColor:      '#9FB3C8',
    bg:             'rgba(255,255,255,0.05)',
    border:         'rgba(255,255,255,0.12)',
  },
};

function _formatSignals(signals) {
  if (!signals || typeof signals !== 'object') return [];
  const out = [];
  if (signals.color)   out.push(['Color',   signals.color]);
  if (signals.size)    out.push(['Size',    signals.size]);
  if (signals.texture) out.push(['Texture', signals.texture]);
  if (Array.isArray(signals.defects) && signals.defects.length > 0) {
    out.push(['Defects', signals.defects.join(', ')]);
  }
  if (Array.isArray(signals.diseaseSigns) && signals.diseaseSigns.length > 0) {
    out.push(['Disease signs', signals.diseaseSigns.join(', ')]);
  }
  if (Array.isArray(signals.pestSigns) && signals.pestSigns.length > 0) {
    out.push(['Pest signs', signals.pestSigns.join(', ')]);
  }
  return out;
}

export default function HarvestReadinessCard({
  result,
  onCreateHarvestTask,
  onSavePlant,
  onScanAgain,
}) {
  if (!result || result.category === 'unknown') return null;

  const status = result.ripenessStatus || 'unknown';
  const palette = STATUS_COPY[status] || STATUS_COPY.unknown;
  const signals = _formatSignals(result.visualSignals);
  const score = Math.max(0, Math.min(100, Number(result.harvestReadinessScore) || 0));
  const conf  = Math.max(0, Math.min(100, Number(result.confidence) || 0));

  return (
    <article
      data-testid="harvest-readiness-card"
      data-ripeness-status={status}
      data-needs-review={result.needsReview ? 'true' : 'false'}
      style={{
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: 14,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        color: '#EAF2FF',
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between',
                       gap: 8, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700,
                        letterSpacing: '0.06em', textTransform: 'uppercase',
                        color: palette.toneColor, marginBottom: 4 }}>
            {tStrict('harvest.eyebrow', 'Harvest readiness')}
          </div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800,
                       color: '#fff', lineHeight: 1.3 }}>
            {tStrict(palette.headlineKey, palette.headlineFallback)}
          </h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column',
                      alignItems: 'flex-end', gap: 4 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: palette.toneColor }}>
            {score}
          </span>
          <span style={{ fontSize: 10, fontWeight: 600,
                         color: '#9FB3C8', letterSpacing: '0.04em' }}>
            {tStrict('harvest.scoreLabel', 'readiness')}
          </span>
        </div>
      </header>

      {result.recommendationBody ? (
        <p style={{ margin: 0, fontSize: 13.5, color: '#EAF2FF',
                    lineHeight: 1.45 }}>
          {result.recommendationBody}
        </p>
      ) : null}

      {result.estimatedHarvestWindow ? (
        <div style={{ fontSize: 12, color: '#9FB3C8' }}>
          {tStrict('harvest.window', 'Expected window:')}{' '}
          <strong style={{ color: '#FDE6C5' }}>{result.estimatedHarvestWindow}</strong>
        </div>
      ) : null}

      {signals.length > 0 ? (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none',
                     display: 'grid', gridTemplateColumns: '1fr 1fr',
                     gap: 6, fontSize: 12 }}>
          {signals.map(([k, v]) => (
            <li key={k} style={{ color: '#9FB3C8' }}>
              <span style={{ fontWeight: 700, marginRight: 4 }}>{k}:</span>
              <span style={{ color: '#EAF2FF' }}>{v}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {conf > 0 ? (
        <div style={{ fontSize: 11, color: '#9FB3C8', fontWeight: 600 }}>
          {tStrict('harvest.confidence', 'Confidence:')} {conf}%
        </div>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        {typeof onCreateHarvestTask === 'function'
          && Array.isArray(result.recommendedTasks)
          && result.recommendedTasks.length > 0 ? (
          <button type="button"
                  onClick={onCreateHarvestTask}
                  data-testid="harvest-create-task"
                  style={{ background: '#C8944D', color: '#fff', border: 'none',
                           padding: '0.625rem 0.875rem', borderRadius: 10,
                           fontSize: 13, fontWeight: 700, cursor: 'pointer',
                           minHeight: 40 }}>
            {tStrict('harvest.action.createTask', 'Create harvest task')}
          </button>
        ) : null}
        {typeof onSavePlant === 'function' ? (
          <button type="button"
                  onClick={onSavePlant}
                  data-testid="harvest-save-plant"
                  style={{ background: 'rgba(255,255,255,0.06)',
                           color: '#EAF2FF',
                           border: '1px solid rgba(255,255,255,0.12)',
                           padding: '0.625rem 0.875rem', borderRadius: 10,
                           fontSize: 13, fontWeight: 700, cursor: 'pointer',
                           minHeight: 40 }}>
            {tStrict('harvest.action.savePlant', 'Save to My Plants')}
          </button>
        ) : null}
        {typeof onScanAgain === 'function' ? (
          <button type="button"
                  onClick={onScanAgain}
                  data-testid="harvest-scan-again"
                  style={{ background: 'transparent', color: '#9FB3C8',
                           border: '1px solid rgba(255,255,255,0.12)',
                           padding: '0.625rem 0.875rem', borderRadius: 10,
                           fontSize: 13, fontWeight: 700, cursor: 'pointer',
                           minHeight: 40 }}>
            {tStrict('harvest.action.scanAgain', 'Scan again')}
          </button>
        ) : null}
      </div>
    </article>
  );
}
