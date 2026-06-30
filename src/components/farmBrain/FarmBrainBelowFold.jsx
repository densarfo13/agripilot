/**
 * FarmBrainBelowFold.jsx — sprint #209, spec "Home / Below fold".
 *
 * Renders the Farm Timeline + Farm Quality below the Home hero. Both
 * are read-only composites over the farm's existing data — no new
 * store, no fetch, no fabrication. When there is no data yet they
 * show the next-best action (no bare empty state).
 *
 * Self-contained, error-boundaried via try/catch, never blocks Home.
 */
import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { buildFarmTimeline } from '../../runtime/farmBrain/FarmTimeline';
import { buildFarmDataQuality } from '../../runtime/farmBrain/FarmDataQualityEngine';
import { buildFarmerCompletion } from '../../runtime/farmerCompletion/FarmerCompletionEngine';
import { buildFarmBrainExplanation } from '../../runtime/farmBrain/FarmBrainExplanation';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _arr = (v) => (Array.isArray(v) ? v : []);

const S = {
  wrap:   { marginTop: 14, display: 'grid', gap: 12 },
  card:   { background: '#fff', borderRadius: 14, padding: '14px 16px', border: '1px solid #E8EDE6' },
  title:  { margin: 0, fontSize: 14, fontWeight: 700, color: '#2E3A26' },
  sub:    { margin: '2px 0 10px', fontSize: 12, color: '#6B7766' },
  row:    { display: 'flex', gap: 8, alignItems: 'baseline', padding: '5px 0', borderBottom: '1px solid #F1F4EE' },
  rowLabel:{ fontSize: 13, color: '#2E3A26' },
  rowAt:  { marginLeft: 'auto', fontSize: 11, color: '#9AA690' },
  qScore: { fontSize: 28, fontWeight: 800, color: '#2E7D32', lineHeight: 1 },
  qLevel: { fontSize: 12, color: '#6B7766', marginLeft: 8 },
  miss:   { fontSize: 13, color: '#5b6b4d', padding: '3px 0' },
  next:   { marginTop: 8, fontSize: 13, fontWeight: 600, color: '#1f6a3a' },
  empty:  { fontSize: 13, color: '#5b6b4d' },
};

/**
 * @param {{ farmSignals?: object }} props farmSignals: { crop, location,
 *   plantingDate, scans[], tasks[], outcomes[], timelineEntries[],
 *   pilotEvents[] } — the page passes what it already has; absent
 *   fields simply lower the quality score / shorten the timeline.
 */
export default function FarmBrainBelowFold({ farmSignals = {} } = {}) {
  const sig = farmSignals && typeof farmSignals === 'object' ? farmSignals : {};

  const timeline = _safe(() => buildFarmTimeline({
    entries: _arr(sig.timelineEntries),
    pilotEvents: _arr(sig.pilotEvents),
  }), null);

  const quality = _safe(() => buildFarmDataQuality({
    crop: sig.crop, location: sig.location, plantingDate: sig.plantingDate,
    scans: _arr(sig.scans), tasks: _arr(sig.tasks), outcomes: _arr(sig.outcomes),
  }), null);

  // Sprint #212 — completion + FarmBrain confidence (compose the
  // farmer-completion engine; no new data).
  const _completionInput = {
    farmExists: _arr(sig.timelineEntries).some((e) => e && e.kind === 'farm_created') || !!sig.crop,
    location: sig.location, crop: sig.crop, plantingDate: sig.plantingDate,
    scanHistory: _arr(sig.scans), taskCompletedCount: _arr(sig.tasks).length,
    outcomeHistory: _arr(sig.outcomes), harvestOrSellDrafts: _arr(sig.harvestOrSellDrafts),
  };
  const completion = _safe(() => buildFarmerCompletion(_completionInput), null);
  const explanation = _safe(() => buildFarmBrainExplanation(_completionInput), null);

  return (
    <div style={S.wrap} data-testid="farm-brain-below-fold">
      {/* FARM SETUP PROGRESS (§1/§3) — guided, never a dead empty state */}
      {completion && !completion.allComplete ? (
        <section style={S.card} data-testid="farm-setup-progress-card">
          <h3 style={S.title}>{tSafe('farm.setup.title', 'Farm Setup')}</h3>
          <div>
            <span style={S.qScore} data-testid="farm-setup-percent">{completion.percentComplete}%</span>
            <span style={S.qLevel}>{tSafe('farm.setup.complete', 'Complete')}</span>
          </div>
          <div style={{ marginTop: 8 }}>
            {completion.completedSteps.slice(0, 8).map((st, i) => (
              <div key={'st-' + i} style={S.miss}>
                {st.done ? '✓' : '○'} {tSafe(st.labelKey, st.key)}
              </div>
            ))}
          </div>
          {completion.nextBestStepKey ? (
            <>
              <div style={S.next} data-testid="farm-setup-next">
                {tSafe('farm.setup.next', 'Next')}: {tSafe(completion.nextBestStepKey, completion.nextBestStep)}
              </div>
              {completion.nextBestStepReason ? (
                <div style={S.miss}>
                  {tSafe('farm.setup.reason', 'Reason')}: {String(completion.nextBestStepReason)}
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}

      {/* FARMBRAIN CONFIDENCE (§8) — no score without explanation */}
      {explanation && explanation.hasExplanation ? (
        <section style={S.card} data-testid="farmbrain-confidence-card">
          <h3 style={S.title}>{tSafe('farmBrain.confidence.title', 'Recommendation confidence')}</h3>
          <span style={S.qScore} data-testid="farmbrain-confidence-score">{explanation.confidence}%</span>
          {_arr(explanation.why).length > 0 ? (
            <div style={{ marginTop: 8 }}>
              <div style={S.qLevel}>{tSafe('farmBrain.confidence.why', 'Why')}</div>
              {explanation.why.slice(0, 5).map((k, i) => (
                <div key={'why-' + i} style={S.miss}>✓ {tSafe(k, k)}</div>
              ))}
            </div>
          ) : null}
          {_arr(explanation.missing).length > 0 ? (
            <div style={{ marginTop: 6 }}>
              <div style={S.qLevel}>{tSafe('farmBrain.confidence.missing', 'Missing')}</div>
              {explanation.missing.slice(0, 5).map((k, i) => (
                <div key={'ms-' + i} style={{ ...S.miss, color: '#92400E' }}>○ {tSafe(k, k)}</div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* FARM QUALITY */}
      {quality ? (
        <section style={S.card} data-testid="farm-quality-card">
          <h3 style={S.title}>{tSafe('farmQuality.title', 'Farm readiness')}</h3>
          <p style={S.sub}>{tSafe('farmQuality.subtitle', 'Complete a few steps to improve your recommendations.')}</p>
          <div>
            <span style={S.qScore} data-testid="farm-quality-score">{quality.score}%</span>
            <span style={S.qLevel}>{tSafe('farmQuality.level.' + quality.level, quality.level)}</span>
          </div>
          {_arr(quality.missingData).length > 0 ? (
            <div style={{ marginTop: 8 }}>
              {quality.missingData.slice(0, 4).map((m, i) => (
                <div key={'q-' + i} style={S.miss}>• {String(m)}</div>
              ))}
            </div>
          ) : null}
          {quality.nextBestAction ? (
            <div style={S.next} data-testid="farm-quality-next">
              {tSafe('farmQuality.improveBy', 'Next')}: {tSafe(
                quality.nextBestAction.actionKey, quality.nextBestAction.action)}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* FARM TIMELINE */}
      <section style={S.card} data-testid="farm-timeline-card">
        <h3 style={S.title}>{tSafe('farmTimeline.title', 'Farm timeline')}</h3>
        {timeline && timeline.active ? (
          <div data-testid="farm-timeline-list">
            {timeline.entries.slice(0, 8).map((e, i) => (
              <div key={'t-' + i} style={S.row}>
                <span style={S.rowLabel}>
                  {tSafe('farmTimeline.kind.' + e.kind, e.label)}
                </span>
                {e.at ? <span style={S.rowAt}>{String(e.at).slice(0, 10)}</span> : null}
              </div>
            ))}
          </div>
        ) : (
          <p style={S.empty} data-testid="farm-timeline-empty">
            {tSafe('farmTimeline.empty',
              'Your timeline starts when you add a crop and run your first scan.')}
          </p>
        )}
      </section>
    </div>
  );
}
