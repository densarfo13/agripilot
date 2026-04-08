import React from 'react';

export default function FarrowayLogo({ size = 32, showText = true, textColor = '#FFFFFF' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.25 }}>
      <svg width={size} height={size} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="fwg" x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0%" stopColor="#C4E538"/>
            <stop offset="30%" stopColor="#7ED957"/>
            <stop offset="60%" stopColor="#38B249"/>
            <stop offset="100%" stopColor="#1B8A3A"/>
          </linearGradient>
        </defs>
        <path d="M200 52 C280 38,390 60,440 120 C470 168,460 240,430 310 C400 380,340 430,270 468 C210 440,140 390,100 320 C60 250,56 170,72 110 C88 68,140 52,200 52Z" fill="url(#fwg)"/>
        <path d="M88 190 C160 160,300 155,450 205" stroke="#0F172A" strokeWidth="16" fill="none" strokeLinecap="round" opacity="0.8"/>
        <path d="M78 275 C155 242,310 235,440 285" stroke="#0F172A" strokeWidth="14" fill="none" strokeLinecap="round" opacity="0.7"/>
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
