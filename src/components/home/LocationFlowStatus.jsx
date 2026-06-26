/**
 * LocationFlowStatus.jsx — Home location-flow feedback + anti-stuck fallback.
 *
 * Rendered just below the hero. Driven by the pure locationFlowView(status):
 *   • detecting → a calm loading line ("Finding your location…").
 *   • denied / unavailable → an explanation + TWO forward paths so the farmer is
 *     never stuck: "Continue with general guidance" (primary escape hatch) and
 *     "Enter location manually".
 *   • idle / dismissed / success → renders nothing.
 *
 * Pure presentation. tSafe for every string. 44px touch targets.
 */
import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { locationFlowView } from './locationFlowState.js';

export default function LocationFlowStatus({ status = 'idle', onEnterManually, onContinueGeneral }) {
  const v = locationFlowView(status);
  if (v.mode === 'hidden') return null;

  if (v.showLoading) {
    return (
      <div
        data-testid="home-location-loading" role="status" aria-live="polite"
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', marginTop: 10,
          borderRadius: 12, background: 'rgba(47,122,58,0.06)', color: '#3a4a3e', fontSize: 14, fontWeight: 600, minHeight: 44 }}
      >
        <span aria-hidden="true" style={{ width: 16, height: 16, border: '2px solid rgba(47,122,58,0.3)',
          borderTopColor: '#2f7a3a', borderRadius: '50%', display: 'inline-block', animation: 'ffLocSpin 0.8s linear infinite' }} />
        <span>{tSafe('home.location.detecting', 'Finding your location…')}</span>
        <style>{'@keyframes ffLocSpin{to{transform:rotate(360deg)}}'}</style>
      </div>
    );
  }

  // Fallback — denied / unavailable. Always offers a guaranteed way forward.
  return (
    <div
      data-testid="home-location-fallback" role="region"
      aria-label={tSafe('home.location.deniedTitle', 'We could not get your location')}
      style={{ padding: '14px 16px', marginTop: 10, borderRadius: 14, background: 'rgba(192,89,15,0.07)', border: '1px solid rgba(192,89,15,0.18)' }}
    >
      <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: '#8a4a12' }}>
        {tSafe('home.location.deniedTitle', 'We could not get your location')}
      </p>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#5a4632', lineHeight: 1.45 }}>
        {tSafe('home.location.deniedWhy', 'Sharing your location gives you weather and timing advice for your exact field. You can still continue without it.')}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <button
          type="button" onClick={onContinueGeneral} data-testid="home-location-continue"
          style={{ flex: '1 1 auto', minHeight: 44, padding: '10px 16px', borderRadius: 12, border: 'none',
            background: '#2f7a3a', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
        >
          {tSafe('home.location.continueGeneral', 'Continue with general guidance')}
        </button>
        <button
          type="button" onClick={onEnterManually} data-testid="home-location-manual"
          style={{ flex: '1 1 auto', minHeight: 44, padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.15)',
            background: '#fff', color: '#2a2f25', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
        >
          {tSafe('home.location.enterManually', 'Enter location manually')}
        </button>
      </div>
    </div>
  );
}
