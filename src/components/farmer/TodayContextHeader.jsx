/**
 * TodayContextHeader — small, single-line chip row that anchors the
 * farmer in their situation before the primary task card does the
 * heavy lifting.
 *
 *   📍 Frederick, Maryland, USA   •   🌱 Tomato   •   Early growth
 *
 * Pure presentational. Takes:
 *   locationLabel  pre-formatted string (city, state, country) — the
 *                  caller assembles this from the resolved region
 *                  profile so we don't duplicate that logic here.
 *   cropLabel      already-localized crop display name
 *   stageLabel     already-localized stage string
 *
 * Deliberately compact so the primary task card dominates above the
 * fold. Any field that's missing is simply skipped.
 */
import { memo } from 'react';

function TodayContextHeader({ locationLabel, cropLabel, stageLabel }) {
  const items = [
    locationLabel && { icon: '\uD83D\uDCCD', text: locationLabel, testId: 'ctx-location' },
    cropLabel && { icon: '\uD83C\uDF31', text: cropLabel, testId: 'ctx-crop' },
    stageLabel && { icon: null, text: stageLabel, testId: 'ctx-stage' },
  ].filter(Boolean);

  if (!items.length) return null;

  return (
    <div style={S.row} data-testid="today-context-header">
      {items.map((it, i) => (
        <span key={it.testId} style={S.item} data-testid={it.testId}>
          {it.icon && <span style={S.icon}>{it.icon}</span>}
          <span style={S.text}>{it.text}</span>
          {i < items.length - 1 && <span style={S.dot}>•</span>}
        </span>
      ))}
    </div>
  );
}

export default memo(TodayContextHeader);

const S = {
  row: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'center',
    gap: '0.375rem 0.5rem',
    fontSize: '0.8125rem',
    color: '#9FB3C8',
    lineHeight: 1.4,
  },
  item: { display: 'inline-flex', alignItems: 'center', gap: '0.375rem' },
  icon: { fontSize: '0.9375rem' },
  text: { color: '#EAF2FF', fontWeight: 500 },
  dot: { color: '#4F6480', margin: '0 0.125rem' },
};
