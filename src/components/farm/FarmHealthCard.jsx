/**
 * FarmHealthCard — three small risk pills + an overall status pill.
 *
 *   Weather risk        ← from farm.weather state (existing context)
 *   Pest risk           ← from farm.pestRisk if present
 *   Planting readiness  ← derived from cropStage proximity
 *
 * Overall status:
 *   • Any "high" risk           → Needs Attention
 *   • Otherwise                 → On Track
 *
 * The card never crashes when an input is missing — that risk is
 * shown as a neutral "—" pill (spec §9: no crash if weather/risk
 * data missing). Only the overall status falls back to On Track
 * when everything is unknown, because a brand-new farm with no
 * data is — by definition — also without alarm signals.
 *
 * Visible text via tStrict; icons inline Lucide-style.
 */

import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { getFarmHealth } from '../../lib/farm/farmFallbacks.js';
import {
  CloudSun, CloudOff, CloudRain,
  Bug, CheckCircle, AlertTriangle, Activity, HeartPulse,
} from '../icons/lucide.jsx';

// Heuristic: stages where planting work is current/imminent. Used
// for the "planting readiness" pill so a farm in vegetative or later
// stages doesn't claim "ready to plant".
const PLANTING_NEAR_STAGES = new Set(['planning', 'land_preparation', 'planting']);

function _weatherRisk(farm) {
  const w = farm?.weather;
  if (!w || typeof w !== 'object') return 'unknown';
  if (w.risk === 'high' || w.severe || w.heavyRain || w.highWind) return 'high';
  if (w.risk === 'medium' || w.dry || w.drySpell)                  return 'medium';
  return 'low';
}

function _pestRisk(farm) {
  const p = farm?.pestRisk;
  if (!p) return 'unknown';
  if (typeof p === 'string') {
    const v = p.toLowerCase();
    if (v === 'high' || v === 'medium' || v === 'low') return v;
    return 'unknown';
  }
  if (typeof p === 'object' && p.level) return _pestRisk({ pestRisk: p.level });
  return 'unknown';
}

function _plantingReadiness(farm) {
  const stage = String(farm?.cropStage || farm?.stage || '').toLowerCase();
  if (!stage) return 'unknown';
  if (PLANTING_NEAR_STAGES.has(stage)) return 'ready';
  return 'past';
}

function _overall(weather, pest) {
  if (weather === 'high' || pest === 'high') return 'needsAttention';
  return 'onTrack';
}

function _toneFor(level) {
  if (level === 'high')   return 'danger';
  if (level === 'medium') return 'warn';
  if (level === 'low' || level === 'ready') return 'ok';
  return 'neutral';
}

export default function FarmHealthCard({ farm }) {
  // Subscribe to language change.
  useTranslation();
  if (!farm) return null;

  // Spec §3 — never show "No data". Use farmFallbacks helpers to
  // produce useful text for each row even when the live data is
  // missing. Helper returns { state, key, fallback, tone } per row
  // + an overall { code, key, fallback, tone } status used at the
  // bottom of the card.
  const health = getFarmHealth(farm, farm.weather, /* risks */ []);

  const overall = health.overall;
  const overallText = tStrict(overall.key, overall.fallback);
  const overallIsAttention = overall.code === 'needs_attention';

  // Weather icon picks itself from the helper's `state` so a
  // "pending" weather still shows a meaningful glyph (CloudOff)
  // rather than CloudSun on a gray empty state.
  const weatherIcon =
    health.weather.state === 'pending' ? <CloudOff size={14} /> :
    health.weather.state === 'high'    ? <CloudRain size={14} /> :
                                          <CloudSun size={14} />;

  const rows = [
    {
      key: 'weather',
      icon: weatherIcon,
      // Single localised line ("Weather update pending" /
      // "Weather risk high" / etc.) — replaces the prior
      // "Weather: No data" pattern.
      text: tStrict(health.weather.key, health.weather.fallback),
      tone: health.weather.tone,
      attentionChip: health.weather.state === 'high',
    },
    {
      key: 'pest',
      icon: <Bug size={14} />,
      text: tStrict(health.pest.key, health.pest.fallback),
      tone: health.pest.tone,
      attentionChip: health.pest.state === 'high',
    },
    {
      key: 'planting',
      icon: <Activity size={14} />,
      text: tStrict(health.planting.key, health.planting.fallback),
      tone: health.planting.tone,
      attentionChip: false,
    },
  ];

  return (
    <section style={S.card} data-testid="farm-health-card">
      <h2 style={S.title}>
        <span aria-hidden="true" style={{ display: 'inline-flex', marginRight: 6, verticalAlign: 'middle' }}>
          <HeartPulse size={16} />
        </span>
        {tStrict('farm.health.title', '')}
      </h2>
      <ul style={S.list}>
        {rows.map((r, idx) => (
          <li
            key={r.key}
            style={{
              ...S.row,
              ...(idx === 0 ? null : S.rowSpaced),
              color: rowColor(r.tone),
            }}
            data-row={r.key}
          >
            <span style={S.rowLeft}>
              <span style={S.icon} aria-hidden="true">{r.icon}</span>
              <span>{r.text || ''}</span>
            </span>
            {/* Inline attention chip when THIS row drives the overall
                status (matches the visual reference's weather row). */}
            {r.attentionChip && overallIsAttention && (
              <span style={S.attentionChip}>
                <AlertTriangle size={12} />
                <span style={{ marginLeft: 4 }}>{overallText || ''}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
      {/* Bottom-of-card overall status when no row carried the
          attention chip. Setup-incomplete farms show a neutral
          info chip (per spec: "missing setup items should be
          neutral, not red"); on-track farms stay green. */}
      {!overallIsAttention && (
        <div
          style={{
            ...S.overallRow,
            ...(overall.tone === 'info' ? S.overallInfo : null),
          }}
          data-testid="farm-health-overall"
          data-tone={overall.tone}
        >
          {overall.tone === 'info'
            ? <Activity size={14} />
            : <CheckCircle size={14} />}
          <span style={{ marginLeft: 6 }}>{overallText || ''}</span>
        </div>
      )}
    </section>
  );
}

function rowColor(tone) {
  if (tone === 'danger') return '#FCA5A5';
  if (tone === 'warn')   return '#FDE68A';
  if (tone === 'ok')     return '#86EFAC';
  return 'rgba(255,255,255,0.75)';
}

const S = {
  card: {
    background: '#102C47',
    border: '1px solid #1F3B5C',
    borderRadius: 12,
    padding: '14px 16px',
    margin: '0 0 12px 0',
  },
  title: {
    margin: '0 0 8px',
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#fff',
  },
  list: { listStyle: 'none', margin: 0, padding: 0 },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    fontSize: '0.85rem',
  },
  rowSpaced: { marginTop: 6 },
  rowLeft: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  icon: { display: 'inline-flex', opacity: 0.85 },
  attentionChip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: '0.7rem',
    fontWeight: 700,
    background: 'rgba(245,158,11,0.18)',
    color: '#FDE68A',
    border: '1px solid rgba(245,158,11,0.35)',
  },
  overallRow: {
    display: 'inline-flex',
    alignItems: 'center',
    marginTop: 8,
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: '0.7rem',
    fontWeight: 700,
    background: 'rgba(34,197,94,0.15)',
    color: '#86EFAC',
    border: '1px solid rgba(34,197,94,0.35)',
  },
  // Neutral / info tone for "Setup incomplete" — per spec §9
  // "missing setup items should be neutral, not red".
  overallInfo: {
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.85)',
    border: '1px solid rgba(255,255,255,0.12)',
  },
};
