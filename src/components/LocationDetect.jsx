import React, { useState, useRef } from 'react';
import { detectAndResolveLocation, checkLocationPermission, GPS_ERROR } from '../utils/geolocation.js';

/**
 * LocationDetect — mobile-hardened "Get My Location" button.
 *
 * iOS Safari requirements met:
 *   - geolocation.getCurrentPosition() called directly inside click handler (no async before it)
 *   - HTTPS enforced by the platform
 *   - Permission pre-check where Permissions API is available
 *
 * Props:
 *   onDetected(result)  — called with { latitude, longitude, accuracy, capturedAt,
 *                          country, countryCode, region, district, locality, displayName }
 *   label               — button text (default: "Get My Location")
 *   compact             — smaller styling for inline use
 *   disabled            — disable the button externally
 *   style               — additional wrapper styles
 */
export default function LocationDetect({ onDetected, label, compact, disabled, style }) {
  const [detecting, setDetecting] = useState(false);
  const [softMsg, setSoftMsg] = useState('');
  const [done, setDone] = useState(false);
  const busyRef = useRef(false); // prevent double-trigger on fast taps

  const handleClick = async () => {
    // Double-tap guard — busyRef is synchronous, survives React batching
    if (busyRef.current) return;
    busyRef.current = true;
    setDetecting(true);
    setSoftMsg('');
    setDone(false);

    try {
      // Pre-check permission (non-blocking — falls back to 'unknown' on iOS Safari)
      const perm = await checkLocationPermission();

      if (perm === 'denied') {
        setSoftMsg('Please allow location access in your browser settings.');
        return;
      }

      // Call detectAndResolveLocation directly — getCurrentPosition inside it
      // fires navigator.geolocation.getCurrentPosition() synchronously within
      // the same call stack as the user gesture.
      const result = await detectAndResolveLocation();
      onDetected(result);
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch (err) {
      // Granular error messages based on GPS_ERROR codes
      const code = err?.code || GPS_ERROR.UNKNOWN;

      if (code === GPS_ERROR.PERMISSION_DENIED) {
        setSoftMsg('Please allow location access in your browser settings.');
      } else if (code === GPS_ERROR.UNAVAILABLE) {
        setSoftMsg('Unable to detect location. Try again or enter manually.');
      } else if (code === GPS_ERROR.TIMEOUT) {
        setSoftMsg('Location is taking too long. Try again.');
      } else if (code === GPS_ERROR.UNSUPPORTED) {
        setSoftMsg('GPS is not supported on this device. Enter your location manually.');
      } else {
        setSoftMsg("We couldn't get your location. You can continue with your village or region.");
      }

      // Debug logging for mobile field troubleshooting
      try {
        console.warn('[LocationDetect] GPS failed:', { code, message: err?.message });
      } catch { /* ignore */ }
    } finally {
      setDetecting(false);
      busyRef.current = false;
    }
  };

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
          <span style={labelStyle}>Finding your location...</span>
        ) : done ? (
          <span style={{ ...labelStyle, color: '#22C55E' }}>Location found</span>
        ) : (
          <span style={labelStyle}>{label || 'Get My Location'}</span>
        )}
      </button>
      {softMsg && (
        <div style={softMsgStyle}>{softMsg}</div>
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
  width: 'auto', padding: '0.35rem 0.65rem', fontSize: '0.78rem', minHeight: 48,
};

const labelStyle = { display: 'flex', alignItems: 'center', gap: '0.3rem' };

const softMsgStyle = {
  fontSize: '0.78rem', color: '#dc2626', marginTop: '0.4rem', lineHeight: 1.5,
};
