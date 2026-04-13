import React, { useEffect } from 'react';

const PULSE_CSS = `
@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
`;

let styleInjected = false;
function injectStyle() {
  if (styleInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.textContent = PULSE_CSS;
  document.head.appendChild(style);
  styleInjected = true;
}

function SkeletonBar({ width = '100%', height = '14px', style: extraStyle }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: '6px',
        background: '#1E293B',
        animation: 'skeleton-pulse 1.5s ease-in-out infinite',
        ...extraStyle,
      }}
    />
  );
}

function RowsSkeleton({ rows = 3 }) {
  const widths = ['100%', '80%', '60%', '90%', '70%', '50%'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonBar
          key={i}
          width={widths[i % widths.length]}
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div style={S.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <SkeletonBar width="40%" height="16px" />
        <SkeletonBar width="20%" height="16px" />
      </div>
      <SkeletonBar width="100%" height="12px" style={{ marginBottom: '10px' }} />
      <SkeletonBar width="85%" height="12px" style={{ marginBottom: '10px' }} />
      <SkeletonBar width="60%" height="12px" />
    </div>
  );
}

function TableSkeleton({ rows = 4 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <div style={S.tableHeader}>
        <SkeletonBar width="25%" height="14px" />
        <SkeletonBar width="20%" height="14px" />
        <SkeletonBar width="15%" height="14px" />
        <SkeletonBar width="20%" height="14px" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={S.tableRow}>
          <SkeletonBar width="25%" height="12px" style={{ animationDelay: `${i * 0.1}s` }} />
          <SkeletonBar width="20%" height="12px" style={{ animationDelay: `${i * 0.1 + 0.05}s` }} />
          <SkeletonBar width="15%" height="12px" style={{ animationDelay: `${i * 0.1 + 0.1}s` }} />
          <SkeletonBar width="20%" height="12px" style={{ animationDelay: `${i * 0.1 + 0.15}s` }} />
        </div>
      ))}
    </div>
  );
}

export default function LoadingSkeleton({ type = 'rows', rows = 3 }) {
  useEffect(() => {
    injectStyle();
  }, []);

  if (type === 'card') return <CardSkeleton />;
  if (type === 'table') return <TableSkeleton rows={rows} />;
  return <RowsSkeleton rows={rows} />;
}

const S = {
  card: {
    borderRadius: '12px',
    background: '#1B2330',
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '1rem',
  },
  tableHeader: {
    display: 'flex',
    gap: '16px',
    padding: '12px 16px',
    background: '#1B2330',
    borderRadius: '8px 8px 0 0',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  tableRow: {
    display: 'flex',
    gap: '16px',
    padding: '12px 16px',
    background: '#1B2330',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
};
