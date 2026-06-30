/**
 * FarmBrainBelowFold.jsx — ONE canonical "Farm Readiness" surface + a compact timeline.
 *
 * Consolidation (Home 10/10 refactor): the three separate progress cards that used to stack
 * here — Farm Setup %, Recommendation confidence %, and Farm data quality % — showed the SAME
 * completion checklist three times with three different percentages. They are now a SINGLE
 * Farm Readiness card: one percentage + plain level (Low/Fair/Good/Strong), the completed +
 * missing items, and one next step. The deeper confidence/quality breakdown is tucked behind
 * a "View details" disclosure so the surface stays calm.
 *
 * Read-only composites over the farm's existing data — no new store, no fetch, no fabrication.
 * Self-contained, error-boundaried via try/catch, never blocks Home.
 */
import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { Link } from 'react-router-dom';
import { buildFarmTimeline } from '../../runtime/farmBrain/FarmTimeline';
import { buildFarmDataQuality } from '../../runtime/farmBrain/FarmDataQualityEngine';
import { buildFarmerCompletion } from '../../runtime/farmerCompletion/FarmerCompletionEngine';
import { buildFarmBrainExplanation } from '../../runtime/farmBrain/FarmBrainExplanation';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _arr = (v) => (Array.isArray(v) ? v : []);

// Plain-language readiness band from a 0–100 percentage (spec §5: Low / Fair / Good / Strong).
function _level(pct) {
  const p = Number(pct) || 0;
  if (p >= 80) return { key: 'farmReadiness.level.strong', label: 'Strong', tone: '#1f6a3a' };
  if (p >= 60) return { key: 'farmReadiness.level.good',   label: 'Good',   tone: '#2E7D32' };
  if (p >= 35) return { key: 'farmReadiness.level.fair',   label: 'Fair',   tone: '#92400E' };
  return { key: 'farmReadiness.level.low', label: 'Low', tone: '#991B1B' };
}

const S = {
  wrap:   { marginTop: 4, display: 'grid', gap: 12 },
  card:   { background: '#fff', borderRadius: 18, padding: '16px 18px',
            border: '1px solid #E8EDE6', boxShadow: '0 1px 3px rgba(20,40,25,0.05)' },
  title:  { margin: 0, fontSize: 15, fontWeight: 800, color: '#1F2A1A', letterSpacing: '-0.01em' },
  sub:    { margin: '3px 0 12px', fontSize: 12.5, color: '#6B7766', lineHeight: 1.45 },
  scoreRow: { display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 },
  qScore: { fontSize: 32, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' },
  qLevel: { fontSize: 13, fontWeight: 700 },
  list:   { display: 'grid', gap: 4 },
  item:   { fontSize: 13, color: '#3A472E', display: 'flex', gap: 8, alignItems: 'baseline' },
  itemMiss: { fontSize: 13, color: '#7A8568', display: 'flex', gap: 8, alignItems: 'baseline' },
  tick:   { color: '#2E7D32', fontWeight: 800 },
  ring:   { color: '#B6C0A6', fontWeight: 800 },
  next:   { marginTop: 12, fontSize: 13.5, fontWeight: 700, color: '#1f6a3a' },
  nextReason: { marginTop: 2, fontSize: 12.5, color: '#6B7766', lineHeight: 1.45 },
  details: { marginTop: 12, borderTop: '1px solid #F1F4EE', paddingTop: 10 },
  summary: { cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: '#33503A',
             listStyle: 'none', WebkitTapHighlightColor: 'transparent' },
  detailLabel: { fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                 color: 'rgba(60,72,55,0.55)', margin: '10px 0 4px' },
  detailItem: { fontSize: 12.5, color: '#5b6b4d', padding: '2px 0' },
  row:    { display: 'flex', gap: 8, alignItems: 'baseline', padding: '7px 0', borderBottom: '1px solid #F1F4EE' },
  rowLabel:{ fontSize: 13.5, color: '#2E3A26' },
  rowAt:  { marginLeft: 'auto', fontSize: 11, color: '#9AA690' },
  empty:  { fontSize: 13, color: '#5b6b4d', lineHeight: 1.45 },
  viewAll: { display: 'inline-block', marginTop: 10, fontSize: 12.5, fontWeight: 700,
             color: '#1f6a3a', textDecoration: 'none' },
};

export default function FarmBrainBelowFold({ farmSignals = {} } = {}) {
  const sig = farmSignals && typeof farmSignals === 'object' ? farmSignals : {};

  const _completionInput = {
    farmExists: _arr(sig.timelineEntries).some((e) => e && e.kind === 'farm_created') || !!sig.crop,
    location: sig.location, crop: sig.crop, plantingDate: sig.plantingDate,
    scanHistory: _arr(sig.scans), taskCompletedCount: _arr(sig.tasks).length,
    outcomeHistory: _arr(sig.outcomes), harvestOrSellDrafts: _arr(sig.harvestOrSellDrafts),
  };
  const completion  = _safe(() => buildFarmerCompletion(_completionInput), null);
  const explanation = _safe(() => buildFarmBrainExplanation(_completionInput), null);
  const quality     = _safe(() => buildFarmDataQuality({
    crop: sig.crop, location: sig.location, plantingDate: sig.plantingDate,
    scans: _arr(sig.scans), tasks: _arr(sig.tasks), outcomes: _arr(sig.outcomes),
  }), null);
  const timeline = _safe(() => buildFarmTimeline({
    entries: _arr(sig.timelineEntries), pilotEvents: _arr(sig.pilotEvents),
  }), null);

  const pct   = completion ? Number(completion.percentComplete) || 0 : 0;
  const level = _level(pct);
  const steps = completion ? _arr(completion.completedSteps) : [];

  return (
    <div style={S.wrap} data-testid="farm-brain-below-fold">

      {/* ── ONE canonical Farm Readiness card ───────────────────── */}
      {completion ? (
        <section style={S.card} data-testid="farm-readiness-card">
          <h3 style={S.title}>{tSafe('farmQuality.title', 'Farm readiness')}</h3>
          <p style={S.sub}>{tSafe('farmQuality.subtitle', 'Complete a few steps to improve your recommendations.')}</p>

          <div style={S.scoreRow}>
            <span style={{ ...S.qScore, color: level.tone }} data-testid="farm-readiness-percent">{pct}%</span>
            <span style={{ ...S.qLevel, color: level.tone }} data-testid="farm-readiness-level">
              {tSafe(level.key, level.label)}
            </span>
          </div>

          <div style={S.list}>
            {steps.slice(0, 8).map((st, i) => (
              <div key={'st-' + i} style={st.done ? S.item : S.itemMiss}>
                <span style={st.done ? S.tick : S.ring} aria-hidden="true">{st.done ? '✓' : '○'}</span>
                {tSafe(st.labelKey, st.key)}
              </div>
            ))}
          </div>

          {completion.nextBestStepKey ? (
            <>
              <div style={S.next} data-testid="farm-readiness-next">
                {tSafe('farm.setup.next', 'Next')}: {tSafe(completion.nextBestStepKey, completion.nextBestStep)}
              </div>
              {completion.nextBestStepReason ? (
                <div style={S.nextReason}>{String(completion.nextBestStepReason)}</div>
              ) : null}
            </>
          ) : null}

          {/* Deeper detail — recommendation confidence + data quality — tucked away (spec §5). */}
          {(explanation && explanation.hasExplanation) || quality ? (
            <details style={S.details} data-testid="farm-readiness-details">
              <summary style={S.summary}>{tSafe('farmReadiness.viewDetails', 'View details')}</summary>

              {explanation && explanation.hasExplanation ? (
                <>
                  <div style={S.detailLabel}>
                    {tSafe('farmBrain.confidence.title', 'Recommendation confidence')}: {explanation.confidence}%
                  </div>
                  {_arr(explanation.missing).slice(0, 5).map((k, i) => (
                    <div key={'ms-' + i} style={S.detailItem}>○ {tSafe(k, k)}</div>
                  ))}
                </>
              ) : null}

              {quality ? (
                <>
                  <div style={S.detailLabel}>
                    {tSafe('farmQuality.detailLabel', 'Data completeness')}: {quality.score}%
                  </div>
                  {quality.nextBestAction ? (
                    <div style={S.detailItem} data-testid="farm-quality-next">
                      {tSafe('farmQuality.improveBy', 'Next')}: {tSafe(
                        quality.nextBestAction.actionKey, quality.nextBestAction.action)}
                    </div>
                  ) : null}
                </>
              ) : null}
            </details>
          ) : null}
        </section>
      ) : null}

      {/* ── Compact Farm timeline — latest 3 + View all (spec §7/§8) ── */}
      <section style={S.card} data-testid="farm-timeline-card">
        <h3 style={S.title}>{tSafe('farmTimeline.title', 'Recent activity')}</h3>
        {timeline && timeline.active ? (
          <div data-testid="farm-timeline-list">
            {timeline.entries.slice(0, 3).map((e, i) => (
              <div key={'t-' + i} style={S.row}>
                <span style={S.rowLabel}>{tSafe('farmTimeline.kind.' + e.kind, e.label)}</span>
                {e.at ? <span style={S.rowAt}>{String(e.at).slice(0, 10)}</span> : null}
              </div>
            ))}
            <Link to="/activity" style={S.viewAll} data-testid="farm-timeline-view-all">
              {tSafe('farmTimeline.viewAll', 'View all')}
            </Link>
          </div>
        ) : (
          <p style={S.empty} data-testid="farm-timeline-empty">
            {tSafe('farmTimeline.empty', 'Your timeline starts when you add a crop and run your first scan.')}
          </p>
        )}
      </section>
    </div>
  );
}
