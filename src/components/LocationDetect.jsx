import React, { useState, useRef } from 'react';
import { detectAndResolveLocation, checkLocationPermission } from '../utils/geolocation.js';
import { tSafe } from '../i18n/tSafe.js';
import api from '../runtime/apiRuntime.js';
import {
  classifyLocationError,
  locationContext,
  recordLocationAttempt,
} from '../runtime/location/classifyLocationError';

/**
 * LocationDetect — mobile-hardened "Get My Location" button.
 *
 * iOS Safari requirements met:
 *   - geolocation.getCurrentPosition() called directly inside click handler (no async before it)
 *   - HTTPS enforced by the platform
 *   - Permission pre-check where Permissions API is available
 *
 * On failure it shows a SPECIFIC reason + the right buttons (never one collapsed
 * "we couldn't get your location") via classifyLocationError, and records a redaction-safe
 * attempt to window.__locationLastAttempt for in-field diagnostics.
 *
 * Props:
 *   onDetected(result)  — { latitude, longitude, accuracy, capturedAt, country, ... }
 *   onManual()          — optional: open manual region entry (enables the "Enter manually" button)
 *   onZip()             — optional: open ZIP/postal entry (enables the "ZIP code" button)
 *   label, compact, disabled, style
 */
export default function LocationDetect({ onDetected, onManual, onZip, label, compact, disabled, style }) {
  const [detecting, setDetecting] = useState(false);
  const [verdict, setVerdict] = useState(null);
  const [done, setDone] = useState(false);
  const busyRef = useRef(false); // prevent double-trigger on fast taps

  const handleClick = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setDetecting(true);
    setVerdict(null);
    setDone(false);

    const ctx = locationContext();
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : null;
    const elapsed = () => (t0 != null && typeof performance !== 'undefined' && performance.now)
      ? performance.now() - t0 : null;
    const base = {
      isSecureContext: ctx.isSecureContext, hasGeolocation: ctx.hasGeolocation,
      browser: ctx.browser, platform: ctx.platform,
    };
    // Record locally (window.__locationLastAttempt) AND fire-and-forget to the operator
    // debug endpoint. The record is already redacted (coarse coords); reporting never blocks
    // and never throws.
    const record = (a) => {
      const rec = recordLocationAttempt(a, new Date().toISOString());
      try { api.post('/location/attempt', rec).catch(() => {}); } catch { /* never block location */ }
      return rec;
    };

    try {
      const perm = await checkLocationPermission();
      if (perm === 'denied') {
        const v = classifyLocationError({ code: 'access_denied' }, ctx);
        setVerdict(v);
        record({ ...base, outcome: 'error', code: v.code, permission: perm, latencyMs: elapsed() });
        return;
      }

      const result = await detectAndResolveLocation();
      onDetected(result);
      setDone(true);
      setTimeout(() => setDone(false), 3000);
      record({
        ...base, outcome: 'success', permission: perm, latencyMs: elapsed(),
        accuracyM: result && result.accuracy, coarseLat: result && result.latitude, coarseLng: result && result.longitude,
        reverseGeocoded: !!(result && (result.country || result.region || result.locality)),
      });
    } catch (err) {
      const v = classifyLocationError(err, ctx);
      setVerdict(v);
      record({ ...base, outcome: 'error', code: v.code, latencyMs: elapsed(), errorMessage: err && err.message });
    } finally {
      setDetecting(false);
      busyRef.current = false;
    }
  };

  const runAction = (key) => {
    if (key === 'retry' || key === 'enable') { handleClick(); return; }
    if (key === 'manual' && typeof onManual === 'function') { onManual(); return; }
    if (key === 'zip' && typeof onZip === 'function') { onZip(); return; }
  };
  // Only show buttons that actually do something: retry/enable always re-attempt;
  // manual/zip only when the parent wired a handler (never a dead button).
  const _actionable = (a) =>
    a.key === 'retry' || a.key === 'enable'
    || (a.key === 'manual' && typeof onManual === 'function')
    || (a.key === 'zip' && typeof onZip === 'function');

  const btnStyle = compact ? compactBtn : fullBtn;

  return (
    <div style={{ ...wrapperStyle, ...style }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={detecting || disabled}
        style={{ ...btnStyle, opacity: detecting || disabled ? 0.6 : 1 }}
      >
        {detecting ? (
          <span style={labelStyle}>{tSafe('home.location.finding', 'Finding your location...')}</span>
        ) : done ? (
          <span style={{ ...labelStyle, color: '#C8944D' }}>{tSafe('home.location.found', 'Location found')}</span>
        ) : (
          <span style={labelStyle}>{label || tSafe('home.location.get', 'Get My Location')}</span>
        )}
      </button>
      {verdict && (
        <div style={softMsgStyle} role="alert" data-testid="location-error" data-code={verdict.code}>
          <div>{tSafe(verdict.titleKey, verdict.titleFallback)}</div>
          <div style={actionRowStyle}>
            {verdict.actions.filter(_actionable).map((a) => (
              <button key={a.key} type="button" onClick={() => runAction(a.key)} style={actionBtnStyle}>
                {tSafe(a.labelKey, a.labelFallback)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const wrapperStyle = {};

const fullBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
  width: '100%', padding: '0.55rem 0.75rem', minHeight: 48,
  background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
  borderRadius: 6, color: '#3B82F6', fontSize: '0.84rem', fontWeight: 600,
  cursor: 'pointer', boxSizing: 'border-box',
  WebkitTapHighlightColor: 'transparent',
};

const compactBtn = {
  ...fullBtn,
  width: 'auto', padding: '0.35rem 0.65rem', fontSize: '0.78rem', minHeight: 44,
};

const labelStyle = { display: 'flex', alignItems: 'center', gap: '0.3rem' };

const softMsgStyle = {
  fontSize: '0.78rem', color: '#dc2626', marginTop: '0.4rem', lineHeight: 1.5,
};

const actionRowStyle = {
  display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem',
};

const actionBtnStyle = {
  minHeight: 44, padding: '0.4rem 0.8rem',
  background: '#fff', border: '1px solid rgba(59,130,246,0.4)', borderRadius: 6,
  color: '#3B82F6', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
};
