/**
 * src/components/outcomes/OutcomeComparisonCard.jsx — wave-36
 * before/after photo comparison card.
 *
 * Props:
 *   beforePhoto:      string | null       // URL or cache key
 *   afterPhoto:       string | null
 *   beforeIso:        string | null       // ISO of the diagnostic scan
 *   afterIso:         string | null       // ISO of the follow-up scan
 *   diseaseDeltaPct:  number | null       // signed % change in disease confidence
 *   severityDelta:    number | null       // signed integer (-/+) severity change
 *   outcomeStatus:    'IMPROVED'|'UNCHANGED'|'WORSENED'|'UNKNOWN'
 *   plantId?:         string
 *
 * Strict-rule audit
 *   • Pure presentational. No effects, no fetch, no localStorage.
 *   • SSR-safe. Never throws (every render path wrapped via _safe).
 *   • NEVER fakes improvement — every value renders verbatim from
 *     props. If a delta is null, the row reads "—" not 0%.
 */

import React from 'react';

function _safe(fn, fb) { try { return fn(); } catch { return fb; } }

function _daysBetween(beforeIso, afterIso) {
  return _safe(() => {
    if (!beforeIso || !afterIso) return null;
    const a = new Date(beforeIso).getTime();
    const b = new Date(afterIso).getTime();
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return Math.max(0, Math.round((b - a) / (24 * 60 * 60 * 1000)));
  }, null);
}

function _fmtPct(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${Math.round(v)}%`;
}
function _fmtNum(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v}`;
}

const STATUS_COLORS = {
  IMPROVED:  { bg: 'rgba(52,211,153,0.12)', fg: '#34D399', label: 'Improved' },
  UNCHANGED: { bg: 'rgba(148,163,184,0.12)', fg: '#94A3B8', label: 'Unchanged' },
  WORSENED:  { bg: 'rgba(248,113,113,0.12)', fg: '#F87171', label: 'Worsened' },
  UNKNOWN:   { bg: 'rgba(245,158,11,0.12)',  fg: '#F59E0B', label: 'Unknown' },
};

function PhotoTile({ src, label, isoLabel }) {
  return (
    <div style={S.photoTile}>
      <div style={S.photoLabel}>{label}</div>
      {src
        ? <img src={src} alt={label} style={S.photo}
               onError={(e) => { try { e.currentTarget.style.display = 'none'; } catch {} }} />
        : <div style={S.photoEmpty}>No photo</div>}
      {isoLabel && <div style={S.photoIso}>{isoLabel}</div>}
    </div>
  );
}

function _fmtIso(iso) {
  return _safe(() => {
    if (!iso) return '';
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '';
    // YYYY-MM-DD — locale-free + greppable
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, '');
}

export default function OutcomeComparisonCard({
  beforePhoto    = null,
  afterPhoto     = null,
  beforeIso      = null,
  afterIso       = null,
  diseaseDeltaPct = null,
  severityDelta  = null,
  outcomeStatus  = 'UNKNOWN',
  plantId        = null,
}) {
  const days = _daysBetween(beforeIso, afterIso);
  const status = STATUS_COLORS[outcomeStatus] || STATUS_COLORS.UNKNOWN;

  return (
    <div style={S.card} data-testid="outcome-comparison-card">
      <header style={S.header}>
        <div style={S.headerLeft}>
          {plantId && <div style={S.plantId}>{plantId}</div>}
          <div style={S.title}>Before · After</div>
        </div>
        <div style={{ ...S.statusPill, background: status.bg, color: status.fg }}>
          {status.label}
        </div>
      </header>

      <div style={S.photos}>
        <PhotoTile src={beforePhoto} label="Before" isoLabel={_fmtIso(beforeIso)} />
        <PhotoTile src={afterPhoto}  label="After"  isoLabel={_fmtIso(afterIso)} />
      </div>

      <dl style={S.deltas}>
        <div style={S.deltaRow}>
          <dt style={S.deltaLabel}>Disease confidence Δ</dt>
          <dd style={S.deltaValue}>{_fmtPct(diseaseDeltaPct)}</dd>
        </div>
        <div style={S.deltaRow}>
          <dt style={S.deltaLabel}>Severity Δ</dt>
          <dd style={S.deltaValue}>{_fmtNum(severityDelta)}</dd>
        </div>
        <div style={S.deltaRow}>
          <dt style={S.deltaLabel}>Days between scans</dt>
          <dd style={S.deltaValue}>{days == null ? '—' : `${days}d`}</dd>
        </div>
      </dl>
    </div>
  );
}

const C = {
  panel:    'rgba(255,255,255,0.04)',
  border:   'rgba(255,255,255,0.10)',
  ink:      '#F4F1EA',
  inkDim:   'rgba(244,241,234,0.65)',
  inkFaint: 'rgba(244,241,234,0.45)',
  accent:   '#C8944D',
};

const S = {
  card: {
    background: C.panel, border: '1px solid '+C.border,
    borderRadius: 14, padding: '1rem 1.1rem',
    color: C.ink,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '0.75rem' },
  headerLeft: { display: 'flex', flexDirection: 'column', gap: '0.15rem' },
  plantId: { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em',
             textTransform: 'uppercase', color: C.accent },
  title:    { fontSize: '1rem', fontWeight: 700 },
  statusPill: { fontSize: '0.6875rem', fontWeight: 700, padding: '0.3rem 0.65rem',
                borderRadius: 999, letterSpacing: '0.06em', textTransform: 'uppercase' },
  photos: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem',
            marginBottom: '0.85rem' },
  photoTile: { background: 'rgba(0,0,0,0.25)', border: '1px solid '+C.border,
               borderRadius: 10, padding: '0.55rem 0.65rem', minHeight: 140,
               display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  photoLabel: { fontSize: '0.6875rem', fontWeight: 700, color: C.inkDim,
                letterSpacing: '0.08em', textTransform: 'uppercase' },
  photo: { width: '100%', height: 110, objectFit: 'cover', borderRadius: 8,
           background: 'rgba(255,255,255,0.04)' },
  photoEmpty: { width: '100%', height: 110, borderRadius: 8,
                background: 'rgba(255,255,255,0.04)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.8125rem', color: C.inkFaint, fontStyle: 'italic' },
  photoIso: { fontSize: '0.6875rem', color: C.inkFaint, fontFamily: 'monospace' },
  deltas: { margin: 0, padding: 0, display: 'flex', flexDirection: 'column',
            gap: '0.4rem' },
  deltaRow: { display: 'flex', justifyContent: 'space-between',
              alignItems: 'baseline', padding: '0.35rem 0.5rem',
              background: 'rgba(255,255,255,0.02)', borderRadius: 8 },
  deltaLabel: { margin: 0, fontSize: '0.8125rem', color: C.inkDim },
  deltaValue: { margin: 0, fontSize: '0.9375rem', fontWeight: 700, fontFamily: 'monospace' },
};
