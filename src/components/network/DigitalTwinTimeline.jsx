/**
 * DigitalTwinTimeline.jsx — Phase 12 farm-timeline visualizer.
 *
 *   <DigitalTwinTimeline net={useNetworkIntelligence({...})} />
 *
 * What this is
 * ────────────
 *   Renders the 4 timelines (health / risk / yield / activity) from
 *   the Phase 12 envelope as simple horizontal sparkline bars. No
 *   chart library required; pure HTML + CSS sized so it stacks on
 *   mobile without overflow.
 *
 *   Trends + local hotspots are surfaced as inline chips above the
 *   timelines so the farmer sees the "what's rising / falling" hint
 *   first.
 *
 *   Strict-rule audit
 *     • Pure render. SSR-safe.
 *     • Caller-injected data only — no fetch, no localStorage.
 *     • All copy via tSafe.
 *     • Self-hides when the envelope is empty.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

const _isObj = (v) => v != null && typeof v === 'object';
const _isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const _arr   = (v) => (Array.isArray(v) ? v : []);

const STYLES = {
  card: {
    background: '#FFFFFF',
    borderRadius: 14,
    padding: '16px 16px 12px',
    margin: '12px 0',
    border: '1px solid rgba(31,41,51,0.06)',
    boxShadow: '0 1px 2px rgba(31,41,51,0.03)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  title: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  chipRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    margin: '8px 0 12px',
  },
  chipDirection: (dir) => ({
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 9px',
    borderRadius: 999,
    background: dir === 'rising' ? 'rgba(239,68,68,0.10)'
              : dir === 'falling' ? 'rgba(16,185,129,0.10)'
              : 'rgba(148,163,184,0.10)',
    color:       dir === 'rising' ? '#991B1B'
              : dir === 'falling' ? '#047857'
              : '#475569',
    border: '1px solid rgba(31,41,51,0.06)',
  }),
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    margin: '6px 0',
  },
  rowLabel: {
    width: 70,
    fontSize: 11,
    color: '#64748B',
    fontWeight: 600,
  },
  bars: {
    flex: 1,
    display: 'flex',
    gap: 2,
    alignItems: 'flex-end',
    height: 36,
    background: 'rgba(31,41,51,0.04)',
    borderRadius: 6,
    padding: '4px 6px',
  },
  bar: (height, color) => ({
    flex: 1,
    minWidth: 2,
    height: Math.max(2, height) + '%',
    background: color,
    borderRadius: 2,
  }),
  hotspot: {
    fontSize: 13,
    color: '#1F2933',
    background: 'rgba(245,158,11,0.10)',
    border: '1px solid rgba(245,158,11,0.20)',
    borderRadius: 8,
    padding: '8px 10px',
    margin: '0 0 10px',
  },
  empty: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    margin: 0,
  },
  scopeNote: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 8,
  },
};

const TREND_LABEL_KEY = {
  pestDetection:    'network.trend.pest',
  diseaseDetection: 'network.trend.disease',
  heatSignal:       'network.trend.heat',
  droughtSignal:    'network.trend.drought',
  needsReview:      'network.trend.needs_review',
};
const TREND_LABEL_DEFAULT = {
  pestDetection:    'Pests',
  diseaseDetection: 'Disease',
  heatSignal:       'Heat',
  droughtSignal:    'Drought',
  needsReview:      'Needs review',
};

function _normRange(arr) {
  const vals = _arr(arr)
    .map((p) => (_isObj(p) && _isNum(p.value)) ? p.value : null)
    .filter((v) => v != null);
  if (vals.length === 0) return { min: 0, max: 0 };
  return { min: Math.min(...vals), max: Math.max(...vals) };
}

function Timeline({ label, points, color }) {
  const arr = _arr(points);
  if (arr.length === 0) return null;
  const { min, max } = _normRange(arr);
  const span = (max - min) || 1;
  return (
    <div style={STYLES.row} data-testid={`twin-timeline-${label.toLowerCase()}`}>
      <div style={STYLES.rowLabel}>{label}</div>
      <div style={STYLES.bars}>
        {arr.map((p, i) => {
          const v = (_isObj(p) && _isNum(p.value)) ? p.value : null;
          const pct = v == null ? 0 : ((v - min) / span) * 100;
          return <div key={(p && p.day) || i}
            style={STYLES.bar(pct, color)} />;
        })}
      </div>
    </div>
  );
}

export default function DigitalTwinTimeline({ net }) {
  if (!_isObj(net)) return null;
  const twin    = net.digitalTwin;
  const trends  = net.trends;
  const hotspots = _arr(trends && trends.hotspots);
  if (!_isObj(twin)) return null;

  const hasData = !!(
       _arr(twin.health).find((p) => p && p.value != null)
    || _arr(twin.risk).find((p) => p && p.value != null)
    || _arr(twin.activity).find((p) => p && p.value > 0)
  );

  return (
    <section style={STYLES.card} data-testid="digital-twin-card"
      role="region"
      aria-label={tSafe('network.twin.title', 'Farm timeline')}
    >
      <div style={STYLES.title}>
        {tSafe('network.twin.title', 'Farm timeline')}
      </div>

      {/* Trend chips */}
      {_isObj(trends) && _isObj(trends.trends) ? (
        <div style={STYLES.chipRow}>
          {Object.values(trends.trends).map((t) => (
            <span key={t.kind} style={STYLES.chipDirection(t.direction)}
              data-testid={`twin-trend-${t.kind}`}>
              {tSafe(TREND_LABEL_KEY[t.kind] || ('network.trend.' + t.kind),
                TREND_LABEL_DEFAULT[t.kind] || t.kind)}
              {' · '}
              {tSafe('network.trend.dir.' + t.direction, t.direction)}
            </span>
          ))}
        </div>
      ) : null}

      {/* Hotspots */}
      {hotspots.map((h) => (
        <div key={h.kind} style={STYLES.hotspot}
          data-testid={`twin-hotspot-${h.kind}`}>
          <strong>{tSafe(h.headlineKey, h.headlineDefault)}</strong>
          <br />
          {tSafe(h.bodyKey, h.bodyDefault)}
        </div>
      ))}

      {/* Timelines */}
      {hasData ? (
        <>
          <Timeline label={tSafe('network.twin.health', 'Health')}
            points={twin.health} color="#16A34A" />
          <Timeline label={tSafe('network.twin.risk', 'Risk')}
            points={twin.risk} color="#F59E0B" />
          <Timeline label={tSafe('network.twin.yield', 'Yield')}
            points={twin.yields} color="#0EA5E9" />
          <Timeline label={tSafe('network.twin.activity', 'Activity')}
            points={twin.activity} color="#A78BFA" />
        </>
      ) : (
        <p style={STYLES.empty}>
          {tSafe('network.twin.empty',
            'Activity will appear here as you scan and complete tasks.')}
        </p>
      )}

      <div style={STYLES.scopeNote}>
        {tSafe('network.twin.scope',
          'Showing your farm’s last ' + (twin.windowDays || 30) + ' days.')}
      </div>
    </section>
  );
}
