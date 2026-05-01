/**
 * ApplyReadinessChecklist — small widget that grades a farmer's
 * application readiness on the 7 spec criteria (§6) and surfaces
 * a single percentage + per-criterion checklist.
 *
 * Inputs are a `farm`-shaped object (the active farm from
 * ProfileContext) and a `tasks`-shaped object (recent activity
 * derived from the existing task store). Both are optional —
 * missing inputs degrade to "0% complete" rather than crashing.
 *
 * Strict-rule audit
 *   • Pure read; never mutates.
 *   • Self-hides nothing — the widget is always shown when
 *     mounted, but each criterion that's already done renders as
 *     a green check + greyed-out label rather than a bullet.
 *   • Visible labels via tStrict; no English leaks in non-en UIs.
 *   • Fires `funding_readiness_change` once per real score change
 *     (not on every parent re-render).
 */

import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { trackFundingEvent } from '../../analytics/fundingAnalytics.js';

const CRITERIA = [
  { id: 'profile',     labelKey: 'funding.readiness.profile',    fallback: 'Farm profile completed' },
  { id: 'location',    labelKey: 'funding.readiness.location',   fallback: 'Location added' },
  { id: 'crop',        labelKey: 'funding.readiness.crop',       fallback: 'Crop added' },
  { id: 'farmSize',    labelKey: 'funding.readiness.farmSize',   fallback: 'Farm size added' },
  { id: 'photos',      labelKey: 'funding.readiness.photos',     fallback: 'Photos / history added' },
  { id: 'tasks',       labelKey: 'funding.readiness.tasks',      fallback: 'Tasks completed recently' },
  { id: 'impactData',  labelKey: 'funding.readiness.impactData', fallback: 'Impact data available' },
];

function _has(value) {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return Boolean(value);
}

/**
 * Compute the per-criterion completion state. Returns an object
 * keyed by criterion id — used by the checklist for rendering.
 */
export function evaluateReadiness({ farm = null, tasks = null, impactData = null } = {}) {
  const completed = {
    profile:    _has(farm?.farmName) || _has(farm?.name),
    location:   _has(farm?.country) || _has(farm?.region) || _has(farm?.location),
    // `crop` is canonical (canonicalizeFarmPayload in lib/api.js).
    crop:       _has(farm?.crop),
    farmSize:   _has(farm?.landSizeHectares) || _has(farm?.farmSize) || _has(farm?.size),
    photos:     _has(farm?.photoUrl) || _has(farm?.profileImageUrl) || _has(farm?.photos),
    tasks:      _has(tasks?.completedCount) || (Array.isArray(tasks?.items) && tasks.items.length > 0),
    impactData: _has(impactData) || _has(farm?.impactData),
  };
  const total = CRITERIA.length;
  const doneCount = CRITERIA.reduce((acc, c) => acc + (completed[c.id] ? 1 : 0), 0);
  const percent = Math.round((doneCount / total) * 100);
  return { completed, doneCount, total, percent };
}

const STYLES = {
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title:  { margin: 0, fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '0.02em' },
  pct: {
    fontSize: 24,
    fontWeight: 800,
    color: '#22C55E',
    fontVariantNumeric: 'tabular-nums',
  },
  bar: {
    width: '100%',
    height: 6,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  fill: { height: '100%', background: '#22C55E', borderRadius: 999 },
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
  },
  rowDone:    { color: 'rgba(255,255,255,0.55)', textDecoration: 'line-through' },
  rowPending: { color: 'rgba(255,255,255,0.85)' },
  iconDone:    { color: '#22C55E', fontWeight: 700 },
  iconPending: { color: 'rgba(255,255,255,0.4)', fontWeight: 700 },
};

export default function ApplyReadinessChecklist({ farm, tasks, impactData, context = {} }) {
  // Subscribe to language change so labels refresh on flip.
  useTranslation();

  const { completed, doneCount, total, percent } = useMemo(
    () => evaluateReadiness({ farm, tasks, impactData }),
    [farm, tasks, impactData],
  );

  // Fire the analytics event only when the percentage actually
  // changes (not on every re-render).
  const lastPctRef = useRef(percent);
  useEffect(() => {
    if (lastPctRef.current === percent) return;
    lastPctRef.current = percent;
    try {
      trackFundingEvent('funding_readiness_change', {
        percent,
        country:  context.country || null,
        userRole: context.userRole || null,
      });
    } catch { /* never propagate */ }
  }, [percent, context.country, context.userRole]);

  const headline = tStrict(
    'funding.readiness.headline',
    'Your application readiness'
  );

  return (
    <section style={STYLES.card} data-testid="apply-readiness-checklist">
      <div style={STYLES.header}>
        <h3 style={STYLES.title}>{headline}</h3>
        <span style={STYLES.pct} aria-label={`${percent}%`}>
          {percent}<span style={{ fontSize: 14, marginLeft: 2, fontWeight: 600 }}>%</span>
        </span>
      </div>
      <div style={STYLES.bar} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ ...STYLES.fill, width: `${percent}%` }} />
      </div>
      <ul style={STYLES.list}>
        {CRITERIA.map((c) => {
          const done = !!completed[c.id];
          return (
            <li key={c.id} style={{ ...STYLES.row, ...(done ? STYLES.rowDone : STYLES.rowPending) }}>
              <span aria-hidden="true" style={done ? STYLES.iconDone : STYLES.iconPending}>
                {done ? '\u2714' : '\u25CB'}
              </span>
              <span>{tStrict(c.labelKey, c.fallback)}</span>
            </li>
          );
        })}
      </ul>
      <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
        {tStrict(
          'funding.readiness.helper',
          'Programs often ask for the items above. Higher readiness usually means a faster application.'
        )} ({doneCount}/{total})
      </p>
    </section>
  );
}
