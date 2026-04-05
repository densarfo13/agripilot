import React from 'react';

export default function ScoreBar({ score, max = 100, label }) {
  const pct = Math.min(100, Math.max(0, (score / max) * 100));
  const color = pct >= 70 ? 'green' : pct >= 40 ? 'yellow' : 'red';

  return (
    <div>
      {label && <div className="flex-between" style={{ marginBottom: '0.25rem' }}>
        <span className="text-sm text-muted">{label}</span>
        <span className="text-sm" style={{ fontWeight: 600 }}>{score}/{max}</span>
      </div>}
      <div className="score-bar">
        <div className={`score-fill ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
