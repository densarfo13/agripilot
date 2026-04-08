import React from 'react';

export default function FarrowayLogo({ size = 32, showText = true, textColor = '#FFFFFF' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.25 }}>
      <img
        src="/icons/logo-shield.png"
        alt="Farroway"
        width={size}
        height={size}
        style={{ borderRadius: size * 0.12 }}
      />
      {showText && (
        <span style={{
          fontSize: size * 0.75,
          fontWeight: 700,
          color: textColor,
          letterSpacing: '-0.01em',
        }}>Farroway</span>
      )}
    </div>
  );
}
