/**
 * CompleteSetupCard — non-blocking "Complete your setup" prompt
 * on Home.
 *
 *   <CompleteSetupCard
 *     missing={{ crop: true, location: false }}
 *     onAddCrop={() => navigate('/my-grow')}
 *     onAddLocation={() => navigate('/my-grow')}
 *   />
 *
 * Spec rule (May 2026 onboarding-loop fix)
 *   "Show a setup card INSIDE the app instead of forcing the
 *    setup screen." Crop and location are now OPTIONAL — the
 *    user keeps using the app, this card surfaces the missing
 *    pieces inline.
 *
 *   Self-hides when nothing is missing.
 *
 * Strict-rule audit
 *   • Pure presentational. Never throws.
 *   • Inline styles only.
 *   • Falls through to no-op handlers when callers don't pass
 *     them, so the card always renders even mid-mount.
 */

import React from 'react';

export default function CompleteSetupCard({
  missing = {},
  onAddCrop,
  onAddLocation,
  onAddStage,
}) {
  const items = [];
  if (missing.crop)     items.push({ key: 'crop',     label: 'Add crop',     onClick: onAddCrop });
  if (missing.location) items.push({ key: 'location', label: 'Add location', onClick: onAddLocation });
  if (missing.stage)    items.push({ key: 'stage',    label: 'Add stage',    onClick: onAddStage });

  if (items.length === 0) return null;

  return (
    <section
      style={S.card}
      data-testid="complete-setup-card"
      data-missing={items.map((i) => i.key).join(',')}
    >
      <div style={S.headRow}>
        <span aria-hidden="true" style={S.icon}>{'\uD83C\uDF31'}</span>
        <div style={S.headText}>
          <h3 style={S.title}>Complete your setup</h3>
          <p style={S.body}>
            These details help Farroway give you better daily advice.
            You can finish them anytime — they\u2019re optional.
          </p>
        </div>
      </div>
      <div style={S.btnRow}>
        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            onClick={() => {
              try { if (typeof it.onClick === 'function') it.onClick(); }
              catch { /* swallow */ }
            }}
            style={S.btn}
            data-testid={`complete-setup-${it.key}`}
          >
            {it.label}
          </button>
        ))}
      </div>
    </section>
  );
}

const S = {
  card: {
    width: '100%',
    maxWidth: '32rem',
    margin: '0 auto 12px',
    padding: '14px 16px',
    borderRadius: 16,
    background: 'var(--card-bg, rgba(255,255,255,0.06))',
    border: '1px dashed var(--card-border, rgba(255,255,255,0.18))',
    color: 'var(--text-primary, #EAF2FF)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  headRow: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
  },
  icon: {
    fontSize: 24,
    lineHeight: 1,
    flexShrink: 0,
  },
  headText: { flex: 1, minWidth: 0 },
  title: {
    margin: 0,
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: '-0.01em',
  },
  body: {
    margin: '4px 0 0',
    fontSize: 13,
    color: 'var(--text-secondary, rgba(255,255,255,0.7))',
    lineHeight: 1.45,
  },
  btnRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  btn: {
    minHeight: 40,
    padding: '8px 14px',
    border: '1px solid var(--card-border, rgba(255,255,255,0.18))',
    borderRadius: 999,
    background: 'var(--card-bg-strong, rgba(255,255,255,0.10))',
    color: 'var(--role-accent, #2ecc71)',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
};
