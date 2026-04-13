import React, { useState } from 'react';
import { detectAndResolveLocation } from '../utils/geolocation.js';

/**
 * LocationDetect — reusable "Get My Location" button with friendly feedback.
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

  const handleClick = async () => {
    setDetecting(true);
    setSoftMsg('');
    setDone(false);
    try {
      const result = await detectAndResolveLocation();
      onDetected(result);
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch {
      // Calm, non-technical fallback — GPS is optional
      setSoftMsg("We couldn't get your exact location. You can continue with your village or region.");
    } finally {
      setDetecting(false);
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
  width: '100%', padding: '0.55rem 0.75rem', minHeight: 44,
  background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
  borderRadius: 6, color: '#3B82F6', fontSize: '0.84rem', fontWeight: 600,
  cursor: 'pointer', boxSizing: 'border-box',
};

const compactBtn = {
  ...fullBtn,
  width: 'auto', padding: '0.35rem 0.65rem', fontSize: '0.78rem', minHeight: 44,
};

const labelStyle = { display: 'flex', alignItems: 'center', gap: '0.3rem' };

const softMsgStyle = {
  fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', marginTop: '0.4rem', lineHeight: 1.5,
};
