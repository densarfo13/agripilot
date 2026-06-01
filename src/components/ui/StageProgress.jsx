/**
 * StageProgress — horizontal crop-stage indicator.
 *
 *   <StageProgress stages={['Seeded','Early growth','Flowering','Harvest']}
 *     currentIndex={1} />
 */
import React from 'react';

export default function StageProgress({ stages, currentIndex = 0, testId = 'stage-progress' }) {
  const list = Array.isArray(stages) ? stages : [];
  return (
    <ol style={S.list} data-testid={testId} aria-label="Crop stage progress">
      {list.map((stage, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li key={i} style={S.step}>
            <span style={{
              ...S.dot,
              background: done || active ? '#6E8B61' : 'rgba(110,139,97,0.25)',
              border: active ? '2px solid #B9853F' : '2px solid transparent',
            }} aria-hidden="true">{done ? '✓' : i + 1}</span>
            <span style={{ ...S.label, color: active ? '#2C3A26' : 'rgba(60,72,55,0.62)',
              fontWeight: active ? 800 : 600 }}>{stage}</span>
            {i < list.length - 1 ? <span style={S.bar} aria-hidden="true" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

const S = {
  list: {
    listStyle: 'none', padding: 0, margin: 0,
    display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto',
  },
  step: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  dot: {
    width: 22, height: 22, borderRadius: '50%',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    color: '#FFFFFF', fontSize: 11, fontWeight: 800, flexShrink: 0,
  },
  label: { fontSize: 11.5, whiteSpace: 'nowrap' },
  bar: { width: 14, height: 2, background: 'rgba(110,139,97,0.25)', flexShrink: 0 },
};
