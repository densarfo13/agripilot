import React from 'react';

export default function FarrowayLogo({ size = 32, showText = true, textColor = '#FFFFFF' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.25 }}>
      <svg width={size} height={size} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="fwg" x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="#B8E635"/>
            <stop offset="35%" stopColor="#4ADE80"/>
            <stop offset="70%" stopColor="#22C55E"/>
            <stop offset="100%" stopColor="#15803D"/>
          </linearGradient>
        </defs>
        <path d="M180 56 C260 36,380 52,432 88 C440 140,436 220,412 292 C388 360,330 416,260 464 C200 420,140 356,108 280 C76 204,80 120,96 76 C120 60,150 56,180 56Z" fill="url(#fwg)"/>
        <path d="M120 195 C180 172,320 164,420 200" stroke="#0F172A" strokeWidth="14" fill="none" strokeLinecap="round" opacity="0.85"/>
        <path d="M112 265 C175 240,330 230,415 268" stroke="#0F172A" strokeWidth="12" fill="none" strokeLinecap="round" opacity="0.75"/>
        <path d="M125 330 C185 310,310 302,390 335" stroke="#0F172A" strokeWidth="10" fill="none" strokeLinecap="round" opacity="0.55"/>
      </svg>
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
