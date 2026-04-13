import React, { useEffect, useState } from 'react';

const LEVEL_COLORS = {
  low: '#22C55E',
  moderate: '#FBBF24',
  high: '#FB923C',
  urgent: '#EF4444',
};

const ANIM_CSS = `
@keyframes score-circle-grow {
  from { stroke-dashoffset: var(--sc-circumference); }
  to { stroke-dashoffset: var(--sc-offset); }
}
`;

let styleInjected = false;
function injectStyle() {
  if (styleInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.textContent = ANIM_CSS;
  document.head.appendChild(style);
  styleInjected = true;
}

function colorFromScore(score) {
  if (score <= 25) return '#22C55E';
  if (score <= 50) return '#FBBF24';
  if (score <= 75) return '#FB923C';
  return '#EF4444';
}

export default function ScoreCircle({ score = 0, size = 120, level }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    injectStyle();
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const clampedScore = Math.min(100, Math.max(0, score || 0));
  const color = level ? (LEVEL_COLORS[level] || colorFromScore(clampedScore)) : colorFromScore(clampedScore);

  const strokeWidth = Math.max(6, size * 0.08);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedScore / 100) * circumference;
  const center = size / 2;

  return (
    <div style={{ width: size, height: size, position: 'relative', display: 'inline-block' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={mounted ? offset : circumference}
          transform={`rotate(-90 ${center} ${center})`}
          style={{
            transition: mounted ? 'stroke-dashoffset 0.8s ease-out' : 'none',
          }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        <span
          style={{
            fontSize: `${size * 0.28}px`,
            fontWeight: 700,
            color: color,
            lineHeight: 1,
          }}
        >
          {clampedScore}
        </span>
        <span
          style={{
            fontSize: `${Math.max(10, size * 0.1)}px`,
            color: '#64748B',
            marginTop: '2px',
          }}
        >
          /100
        </span>
      </div>
    </div>
  );
}
