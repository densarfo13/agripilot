/**
 * HomeNextStepCard.jsx — additive "do this next" card for an incomplete farm.
 *
 * Renders the onboarding ladder step from homeNextStep() (create farm → add crop →
 * add location → first scan). Self-hides (null) once the farm is set up — it does NOT
 * touch the hero's live decision, so it can never regress it. Farmer-facing copy only
 * ("Recommended", not confidence enums or backend terms). 44px touch target.
 */
import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

export default function HomeNextStepCard({ step, onAct }) {
  if (!step) return null;
  return (
    <div
      data-testid="home-next-step" data-step={step.key} role="region"
      style={{ marginTop: 10, padding: '14px 16px', borderRadius: 14, background: 'rgba(47,122,58,0.07)', border: '1px solid rgba(47,122,58,0.18)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span aria-hidden="true" style={{ fontSize: 18 }}>🌱</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#5a6472', letterSpacing: 0.3 }}>
          {tSafe('home.next.eyebrow', 'Do this next')}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#256b30', background: 'rgba(47,122,58,0.12)', padding: '2px 8px', borderRadius: 999 }}>
          {tSafe('home.next.recommended', 'Recommended')}
        </span>
      </div>
      <p style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 800, color: '#1f3326' }}>
        {tSafe(step.titleKey, step.titleFallback)}
      </p>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#3a4a3e', lineHeight: 1.45 }}>
        {tSafe(step.reasonKey, step.reasonFallback)}
      </p>
      <button
        type="button" onClick={onAct} data-testid="home-next-step-cta"
        style={{ minHeight: 44, width: '100%', padding: '10px 16px', borderRadius: 12, border: 'none', background: '#2f7a3a', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
      >
        {tSafe(step.ctaKey, step.ctaFallback)}
      </button>
    </div>
  );
}
