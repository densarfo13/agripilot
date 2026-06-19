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

  return (
    <div style={S.wrap} data-testid="farm-brain-below-fold">
      {/* FARM QUALITY */}
      {quality ? (
        <section style={S.card} data-testid="farm-quality-card">
          <h3 style={S.title}>{tSafe('farmQuality.title', 'Farm data quality')}</h3>
          <p style={S.sub}>{tSafe('farmQuality.subtitle', 'Better data means better advice')}</p>
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
              {tSafe('farmQuality.improveBy', 'Improve by')}: {tSafe(
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
