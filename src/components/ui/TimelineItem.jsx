/**
 * TimelineItem — one row of the Activity timeline. Icon + label + meta.
 * Newest-first ordering happens at the page level.
 *
 *   <TimelineItem icon="✓" label="Task completed" detail="Check onion leaves"
 *     timeAgo="2h ago" />
 */
import React from 'react';

export default function TimelineItem({ icon, label, detail, timeAgo, testId = 'timeline-item' }) {
  return (
    <li style={S.row} data-testid={testId}>
      <div style={S.iconWrap} aria-hidden="true"><span style={S.icon}>{icon || '•'}</span></div>
      <div style={S.body}>
        <p style={S.label}>{label || '—'}</p>
        {detail ? <p style={S.detail}>{detail}</p> : null}
      </div>
      {timeAgo ? <span style={S.time}>{timeAgo}</span> : null}
    </li>
  );
}

const S = {
  row: {
    listStyle: 'none', display: 'flex', alignItems: 'flex-start', gap: 12,
    padding: '12px 12px', background: '#FFFFFF', borderRadius: 14,
    border: '1px solid rgba(60,72,55,0.08)',
  },
  iconWrap: {
    width: 30, height: 30, borderRadius: '50%',
    background: 'rgba(110,139,97,0.15)', color: '#33503A',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  icon: { fontSize: 13, fontWeight: 800 },
  body: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 },
  label: { margin: 0, fontSize: 14, fontWeight: 700, color: '#2C3A26' },
  detail: { margin: 0, fontSize: 13, color: 'rgba(60,72,55,0.72)', lineHeight: 1.4 },
  time: { fontSize: 11, color: 'rgba(60,72,55,0.55)', flexShrink: 0, marginTop: 2 },
};
