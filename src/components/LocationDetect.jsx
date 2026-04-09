import React, { useState } from 'react';
import { detectAndResolveLocation } from '../utils/geolocation.js';

/**
 * LocationDetect — reusable "Use current location" button with feedback.
 *
 * Props:
 *   onDetected(result)  — called with { latitude, longitude, accuracy, capturedAt,
 *                          country, countryCode, region, district, locality, displayName }
 *   label               — button text (default: "Use current location")
 *   compact             — smaller styling for inline use
 *   disabled            — disable the button externally
 *   style               — additional wrapper styles
 */
export default function LocationDetect({ onDetected, label, compact, disabled, style }) {
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleClick = async () => {
    setDetecting(true);
    setError('');
    setDone(false);
    try {
      const result = await detectAndResolveLocation();
      onDetected(result);
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch (err) {
      setError(err.message || 'Could not detect location.');
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
          <span style={labelStyle}>Detecting...</span>
        ) : done ? (
          <span style={{ ...labelStyle, color: '#22C55E' }}>Location detected</span>
        ) : (
          <span style={labelStyle}>{label || 'Use current location'}</span>
        )}
      </button>
      {error && (
        <div style={errorStyle}>{error}</div>
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
  width: 'auto', padding: '0.35rem 0.65rem', fontSize: '0.78rem', minHeight: 38,
};

const labelStyle = { display: 'flex', alignItems: 'center', gap: '0.3rem' };

const errorStyle = {
  fontSize: '0.78rem', color: '#F59E0B', marginTop: '0.3rem', lineHeight: 1.4,
};
