/**
 * PremiumActionCard — cream "Today's Action" card for the premium mobile
 * direction. Separate from the legacy ActionCard.jsx (different visual
 * direction, different call sites).
 *
 *   <PremiumActionCard eyebrow="Today's action" title="Check onion leaves"
 *     effort="2 min" cta="Start check" onCta={() => navigate('/scan')} />
 */
import React from 'react';

export default function PremiumActionCard({
  eyebrow, title, body, effort, cta, onCta,
  secondary = null, testId = 'premium-action-card',
}) {
  return (
    <section style={S.card} data-testid={testId}>
      {eyebrow ? <p style={S.eyebrow}>{eyebrow}</p> : null}
      {title ? <h2 style={S.title}>{title}</h2> : null}
      {body ? <p style={S.body}>{body}</p> : null}
      {effort ? <div style={S.metaRow}><span style={S.effort}>⏱ {effort}</span></div> : null}
      <div style={S.btnRow}>
        {cta ? (
          <button type="button" style={S.btnPrimary} onClick={onCta}
            data-testid={`${testId}-cta`}>
            {cta}
          </button>
        ) : null}
        {secondary}
      </div>
    </section>
  );
}

const S = {
  card: {
    background: '#F8F1E1', color: '#2C3A26', borderRadius: 22,
    border: '1px solid rgba(60,72,55,0.10)', padding: '18px 18px 16px',
    display: 'flex', flexDirection: 'column', gap: 8,
    boxShadow: '0 10px 24px -16px rgba(60,72,55,0.20)',
  },
  eyebrow: {
    margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.62)',
  },
  title: { margin: '4px 0 0', fontSize: 19, fontWeight: 800, lineHeight: 1.3 },
  body: { margin: '4px 0 0', fontSize: 14, color: 'rgba(60,72,55,0.78)', lineHeight: 1.5 },
  metaRow: { display: 'flex', alignItems: 'center', gap: 8 },
  effort: { fontSize: 12, color: 'rgba(60,72,55,0.62)', fontWeight: 600 },
  btnRow: { display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  btnPrimary: {
    flex: '1 1 auto', minHeight: 46, padding: '0.8rem 1.2rem', border: 'none',
    borderRadius: 999, background: 'linear-gradient(180deg,#B9853F 0%,#A4742F 100%)',
    color: '#FFFFFF', fontSize: 15, fontWeight: 800, cursor: 'pointer',
    boxShadow: '0 10px 24px rgba(185,133,63,0.30)',
    WebkitTapHighlightColor: 'transparent',
  },
};
