/**
 * PremiumHeroCard — dark-green premium page hero (rounded-3xl, soft border,
 * cream-on-green text). Pages adopt this for the action-first hero strip
 * specified in the premium mobile UI direction.
 *
 *   <PremiumHeroCard eyebrow="My farm" title="Your farm at a glance"
 *     subtitle="…" actions={<PageActions />} />
 */
import React from 'react';

export default function PremiumHeroCard({
  eyebrow, title, subtitle, actions, children, testId = 'premium-hero',
}) {
  return (
    <section style={S.hero} data-testid={testId}>
      <div style={S.row}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {eyebrow ? <p style={S.eyebrow}>{eyebrow}</p> : null}
          {title ? <h1 style={S.title}>{title}</h1> : null}
          {subtitle ? <p style={S.subtitle}>{subtitle}</p> : null}
        </div>
        {actions ? <div style={S.actions}>{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

const S = {
  hero: {
    background: 'linear-gradient(180deg, #1F3A2F 0%, #234638 100%)',
    color: '#F5EFE3',
    borderRadius: 24,
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '20px 18px',
    boxShadow: '0 14px 36px -18px rgba(0,0,0,0.45)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  row: { display: 'flex', alignItems: 'flex-start', gap: 12 },
  eyebrow: {
    margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.10em',
    textTransform: 'uppercase', color: 'rgba(245,239,227,0.62)',
  },
  title: { margin: '4px 0 0', fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' },
  subtitle: { margin: '6px 0 0', fontSize: 14, color: 'rgba(245,239,227,0.78)', lineHeight: 1.45 },
  actions: { display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 },
};
