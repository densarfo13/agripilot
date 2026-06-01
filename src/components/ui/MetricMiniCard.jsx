/**
 * MetricMiniCard — compact secondary card for "Crop / Stage", "Tasks today",
 * "Next check" etc. The premium mobile direction renders 2-up rows of
 * these below the primary ActionCard.
 *
 *   <MetricMiniCard eyebrow="Crop" title="Onion" value="Early growth" />
 */
import React from 'react';

export default function MetricMiniCard({ eyebrow, title, value, icon, testId = 'metric-mini' }) {
  return (
    <section style={S.card} data-testid={testId}>
      <div style={S.head}>
        {icon ? <span aria-hidden="true" style={S.icon}>{icon}</span> : null}
        {eyebrow ? <p style={S.eyebrow}>{eyebrow}</p> : null}
      </div>
      {title ? <p style={S.title}>{title}</p> : null}
      {value ? <p style={S.value}>{value}</p> : null}
    </section>
  );
}

const S = {
  card: {
    background: '#FFFFFF', color: '#2C3A26', borderRadius: 18,
    border: '1px solid rgba(60,72,55,0.10)', padding: '14px',
    display: 'flex', flexDirection: 'column', gap: 4, minHeight: 88,
  },
  head: { display: 'flex', alignItems: 'center', gap: 6 },
  icon: { fontSize: 14 },
  eyebrow: {
    margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.55)',
  },
  title: { margin: '4px 0 0', fontSize: 15, fontWeight: 800 },
  value: { margin: 0, fontSize: 13, color: 'rgba(60,72,55,0.72)' },
};
