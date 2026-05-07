/**
 * NeedsAttentionPanel — top-of-dashboard actionable indicators.
 *
 *   <NeedsAttentionPanel
 *     inactiveFarmers={4}
 *     incompleteProfiles={2}
 *     missedTasks={7}
 *     highRisk={1}          // optional 4th indicator
 *     onOpenFarmers={() => navigate('/admin/farmers?filter=inactive')}
 *   />
 *
 * Contract (spec):
 *   • 3–4 indicators max — nothing else. Complex scoring deliberately
 *     out of scope.
 *   • Deterministic: inputs straight from already-computed counts
 *     (NGO insights engine / farm roster / task engine).
 *   • Zero-state friendly: when everything is 0, renders a single
 *     reassuring "All clear" row instead of four grey tiles.
 *
 * Styling matches the rest of AdminPolish (frosted-glass dark card,
 * tone pills), so the panel visually belongs in the dashboard
 * without a standalone redesign.
 */

import React from 'react';

function tonePill(count) {
  if (!Number.isFinite(count) || count <= 0) return TONES.ok;
  if (count >= 10) return TONES.danger;
  if (count >= 5)  return TONES.warn;
  return TONES.info;
}

const TONES = Object.freeze({
  ok:     { fg: '#86EFAC', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.25)' },
  info:   { fg: '#93C5FD', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)' },
  warn:   { fg: '#FDE68A', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.30)' },
  danger: { fg: '#FCA5A5', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.35)' },
});

/**
 * NeedsAttentionPanel — small actionable indicator row.
 *
 * All count props default to 0; label props default to terse English
 * copy but every string honours the caller's i18n via simple props.
 */
export default function NeedsAttentionPanel({
  inactiveFarmers    = 0,
  incompleteProfiles = 0,
  missedTasks        = 0,
  highRisk,                 // optional — include to render a 4th tile
  titleLabel         = 'Needs attention',
  allClearLabel      = 'Everything looks clear \u2014 no urgent follow-ups.',
  labels = {
    inactive:   'Inactive farmers',
    incomplete: 'Profiles incomplete',
    missed:     'Missed tasks',
    highRisk:   'High risk',
  },
  onOpenInactive,
  onOpenIncomplete,
  onOpenMissed,
  onOpenHighRisk,
}) {
  const indicators = [
    {
      key:     'inactive',
      label:   labels.inactive,
      count:   Number(inactiveFarmers)    || 0,
      onClick: onOpenInactive,
    },
    {
      key:     'incomplete',
      label:   labels.incomplete,
      count:   Number(incompleteProfiles) || 0,
      onClick: onOpenIncomplete,
    },
    {
      key:     'missed',
      label:   labels.missed,
      count:   Number(missedTasks)        || 0,
      onClick: onOpenMissed,
    },
  ];
  if (highRisk !== undefined) {
    indicators.push({
      key:     'highRisk',
      label:   labels.highRisk,
      count:   Number(highRisk) || 0,
      onClick: onOpenHighRisk,
    });
  }

  const totalPending = indicators.reduce((n, i) => n + i.count, 0);

  return (
    <section
      data-testid="needs-attention-panel"
      data-pending={totalPending}
      style={S.panel}
      aria-label={titleLabel}
    >
      <header style={S.header}>
        <span style={S.headerIcon} aria-hidden="true">{'\uD83D\uDCCC'}</span>
        <span style={S.headerTitle}>{titleLabel}</span>
        {totalPending > 0 && (
          <span style={S.headerTotal} data-testid="needs-attention-total">
            {totalPending}
          </span>
        )}
      </header>

      {totalPending === 0 ? (
        <div style={S.allClear} data-testid="needs-attention-all-clear">
          <span aria-hidden="true" style={{ marginRight: 8 }}>{'\u2713'}</span>
          {allClearLabel}
        </div>
      ) : (
        <div style={S.row} data-testid="needs-attention-row">
          {indicators.map((ind) => (
            <Indicator key={ind.key} {...ind} />
          ))}
        </div>
      )}
    </section>
  );
}

function Indicator({ label, count, onClick, key: _key }) {
  const t = tonePill(count);
  const clickable = typeof onClick === 'function' && count > 0;
  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      data-testid={`attention-${_key || label}`}
      data-count={count}
      style={{
        ...S.tile,
        borderColor: t.border,
        background: t.bg,
        color: t.fg,
        cursor: clickable ? 'pointer' : 'default',
      }}
    >
      <span style={S.tileCount}>{count}</span>
      <span style={S.tileLabel}>{label}</span>
    </button>
  );
}

const S = {
  panel: {
    padding: '14px 16px', borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    marginBottom: 16,
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
  },
  headerIcon:  { fontSize: '0.95rem' },
  headerTitle: {
    fontSize: '0.85rem', fontWeight: 700, letterSpacing: 0.4,
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)',
  },
  headerTotal: {
    marginLeft: 'auto', padding: '2px 10px', borderRadius: 999,
    fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
    color: '#0B1D34', background: '#E5E7EB',
  },
  allClear: {
    padding: '10px 12px', borderRadius: 10,
    border: '1px solid rgba(34,197,94,0.25)',
    background: 'rgba(34,197,94,0.06)',
    color: '#86EFAC', fontSize: 13,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 10,
  },
  tile: {
    textAlign: 'left', padding: '12px 14px', borderRadius: 12,
    border: '1px solid', boxSizing: 'border-box',
    display: 'flex', flexDirection: 'column', gap: 4,
    fontFamily: 'inherit',
  },
  tileCount: { fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.1 },
  tileLabel: { fontSize: '0.75rem', fontWeight: 600, opacity: 0.85 },
};

export const _internal = Object.freeze({ TONES, tonePill });
