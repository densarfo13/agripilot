/**
 * StandardPostHarvest.jsx — Standard Mode post-harvest renderer (hard-split
 * partner of SimplePostHarvest).
 *
 * The full standard surface composes over the existing PostHarvestEngine
 * (src/runtime/dailyPlan/PostHarvestEngine.ts) which already returns a
 * richer envelope — harvest checklist, drying/curing, storage guidance,
 * spoilage risk, selling readiness. The buyer listing surface is built
 * separately. This component renders that detailed plan via a simple
 * panel that lists each section as-is.
 */

import React from 'react';

function _safe(fn, fb) { try { return fn(); } catch { return fb; } }
function _probe(name) {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

export default function StandardPostHarvest({ cropKey }) {
  const [plan, setPlan] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    import('../../runtime/dailyPlan/PostHarvestEngine')
      .then((m) => {
        const built = _safe(() => m.postHarvestGuidance(cropKey || 'general'), null);
        if (alive && built) setPlan(built);
      })
      .catch(() => { /* swallow */ });
    return () => { alive = false; };
  }, [cropKey]);

  const ph = plan || _probe('__postHarvestHealth');

  return (
    <section style={S.section} data-testid="standard-post-harvest" data-renderer="standard">
      <h2 style={S.title}>Post-harvest plan</h2>
      {!ph ? <p style={S.empty}>Loading guidance…</p> : (
        <pre style={S.pre}>{_safe(() => JSON.stringify(ph, null, 2), '—')}</pre>
      )}
    </section>
  );
}

const S = {
  section: { padding: '1rem', background: '#FFFFFF', borderRadius: 14,
    border: '1px solid #E5E7EB' },
  title: { margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 800 },
  empty: { fontSize: '0.9rem', color: '#6B7280' },
  pre: { margin: 0, fontSize: 11, color: '#374151', whiteSpace: 'pre-wrap',
    wordBreak: 'break-all', maxHeight: 320, overflow: 'auto', fontFamily: 'ui-monospace, monospace' },
};
