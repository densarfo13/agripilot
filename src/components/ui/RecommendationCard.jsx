/**
 * RecommendationCard — "Best match" card for the Funding recommendation-first
 * surface. Carries the hedged "may qualify" language; never claims guaranteed
 * eligibility.
 *
 *   <RecommendationCard
 *     eyebrow="Best match"
 *     title="Climate-Smart Agriculture Support"
 *     reasons={['Onion cultivation','Maryland, United States','Small farm profile']}
 *     cta="View program"
 *     onCta={...}
 *   />
 *
 * If no real matches: pass `empty` true to render the §6 fallback.
 */
import React from 'react';

export default function RecommendationCard({
  eyebrow = 'Best match', title, reasons, cta = 'View program', onCta,
  empty = false, testId = 'recommendation-card',
}) {
  if (empty) {
    return (
      <section style={S.card} data-testid={`${testId}-empty`}>
        <p style={S.eyebrow}>No strong matches yet</p>
        <p style={S.body}>
          Add your crop, region, and farm size to see programs you may qualify for.
        </p>
      </section>
    );
  }
  return (
    <section style={S.card} data-testid={testId}>
      <p style={S.eyebrow}>{eyebrow}</p>
      {title ? <h2 style={S.title}>{title}</h2> : null}
      {Array.isArray(reasons) && reasons.length > 0 ? (
        <div>
          <p style={S.why}>Why it may match</p>
          <ul style={S.reasons}>
            {reasons.map((r, i) => <li key={i} style={S.reason}>{r}</li>)}
          </ul>
        </div>
      ) : null}
      <p style={S.hedge}>You may qualify — eligibility confirmed by the program.</p>
      <button type="button" style={S.btnPrimary} onClick={onCta}
        data-testid={`${testId}-cta`}>{cta}</button>
    </section>
  );
}

const S = {
  card: {
    background: '#F8F1E1', color: '#2C3A26', borderRadius: 22,
    border: '1px solid rgba(60,72,55,0.10)', padding: '18px',
    display: 'flex', flexDirection: 'column', gap: 8,
    boxShadow: '0 10px 24px -16px rgba(60,72,55,0.20)',
  },
  eyebrow: {
    margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.62)',
  },
  title: { margin: '4px 0 0', fontSize: 18, fontWeight: 800, lineHeight: 1.3 },
  why: { margin: '6px 0 4px', fontSize: 12, fontWeight: 700, color: 'rgba(60,72,55,0.72)' },
  reasons: { listStyle: 'disc inside', padding: 0, margin: 0, fontSize: 13, color: 'rgba(60,72,55,0.78)' },
  reason: { lineHeight: 1.4 },
  body: { margin: 0, fontSize: 14, color: 'rgba(60,72,55,0.78)', lineHeight: 1.5 },
  hedge: { margin: '4px 0 0', fontSize: 12, color: 'rgba(60,72,55,0.55)', fontStyle: 'italic' },
  btnPrimary: {
    alignSelf: 'flex-start', marginTop: 6, padding: '0.7rem 1.2rem', border: 'none',
    borderRadius: 999, background: 'linear-gradient(180deg,#B9853F 0%,#A4742F 100%)',
    color: '#FFFFFF', fontSize: 14, fontWeight: 800, cursor: 'pointer',
    boxShadow: '0 10px 24px rgba(185,133,63,0.30)',
    WebkitTapHighlightColor: 'transparent',
  },
};
