import React from 'react';

/**
 * Reusable skeleton loader — matches card/stat/table shapes
 * Uses CSS classes from index.css (.skeleton, .skeleton-text, .skeleton-card, etc.)
 */

export function SkeletonCard({ lines = 3, style }) {
  return (
    <div className="skeleton-card" style={style}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton-text" style={{ width: i === 0 ? '60%' : i === lines - 1 ? '40%' : '85%' }} />
      ))}
    </div>
  );
}

export function SkeletonStatGrid({ count = 4 }) {
  return (
    <div className="stats-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="stat-card">
          <div className="skeleton-text" style={{ width: '50%', height: '0.7rem', marginBottom: '0.5rem' }} />
          <div className="skeleton-text" style={{ width: '35%', height: '1.5rem' }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="skeleton-card">
      <div className="skeleton-text" style={{ width: '30%', height: '0.9rem', marginBottom: '1rem' }} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
          <div className="skeleton-text" style={{ width: '25%' }} />
          <div className="skeleton-text" style={{ width: '20%' }} />
          <div className="skeleton-text" style={{ width: '15%' }} />
          <div className="skeleton-text" style={{ width: '20%' }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <>
      <div className="page-header">
        <div className="skeleton-text" style={{ width: '140px', height: '1.5rem' }} />
      </div>
      <div className="page-body">
        <SkeletonStatGrid count={4} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
        </div>
        <SkeletonTable rows={4} />
      </div>
    </>
  );
}

export function SkeletonFarmerDashboard() {
  return (
    <div style={{ maxWidth: '600px', margin: '2rem auto', padding: '0 1rem' }}>
      <div className="skeleton-text" style={{ width: '60%', height: '1.3rem', marginBottom: '0.5rem' }} />
      <div className="skeleton-text" style={{ width: '40%', height: '0.8rem', marginBottom: '1.5rem' }} />
      <SkeletonCard lines={3} />
      <div style={{ marginTop: '1rem' }}><SkeletonCard lines={4} /></div>
      <div style={{ marginTop: '1rem' }}><SkeletonCard lines={2} /></div>
    </div>
  );
}
