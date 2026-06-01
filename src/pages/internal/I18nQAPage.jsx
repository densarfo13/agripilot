/**
 * I18nQAPage — internal, admin-only translation QA dashboard.
 *
 *   <Route path="/internal/i18n" element={
 *     <RoleRoute roles={ADMIN_ROLES}><I18nQAPage /></RoleRoute>
 *   } />
 *
 * Shows REAL i18n state from the live diagnostics — coverage by
 * locale, translator-review queue, entity coverage, offline pack
 * status, voice alignment, message-template status. No fabricated
 * coverage.
 */

import React, { useEffect, useState } from 'react';
import reviewQueue from '../../i18n/translatorReviewQueue.json';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _call = (name) => _safe(() => {
  const w = window;
  return (w && typeof w[name] === 'function') ? w[name]() : null;
}, null);

export default function I18nQAPage() {
  const [snap, setSnap] = useState(null);
  const refresh = () => setSnap({
    review:    _call('__translationReviewHealth'),
    language:  _call('__languageHealth'),
    state:     _call('__languageState'),
    offline:   _call('__offlineLanguageHealth'),
    voice:     _call('__voiceLanguageHealth'),
    templates: _call('__messageTemplateHealth'),
  });
  useEffect(() => { const t = setTimeout(refresh, 400); return () => clearTimeout(t); }, []);

  const entries = _safe(() => (reviewQueue && Array.isArray(reviewQueue.entries) ? reviewQueue.entries : []), []);

  return (
    <main style={S.page} data-testid="internal-i18n">
      <div style={S.head}>
        <h1 style={S.title}>Translation QA</h1>
        <button type="button" style={S.btn} onClick={refresh} data-testid="i18n-refresh">Refresh</button>
      </div>
      <p style={S.sub}>Real <code>__languageHealth()</code> + review queue — no fabricated coverage.</p>

      {!snap ? <p style={S.empty}>Loading diagnostics…</p> : (
        <div style={S.grid}>
          {(() => {
            const r = snap.review;
            const PD = { REVIEWED: '#10B981', IN_REVIEW: '#FBBF24', NEEDS_REVIEW: '#FBBF24', UNKNOWN: '#475569' };
            const SD = { PASS: '#10B981', FAIL: '#F87171', NEEDS_TEST: '#FBBF24', UNKNOWN: '#475569' };
            const locs = [['Twi (tw)', 'twReviewStatus'], ['Hausa (ha)', 'haReviewStatus'],
              ['Swahili (sw)', 'swReviewStatus'], ['Hindi (hi)', 'hiReviewStatus']];
            return (
              <section style={{ ...S.card, gridColumn: '1 / -1' }} data-testid="translation-review-proof">
                <div style={S.cardTitle}>
                  Translation review proof —{' '}
                  <span style={{ color: SD[(r && r.proofStatus) || 'UNKNOWN'] }}>
                    {(r && r.proofStatus) || 'UNKNOWN'}
                  </span>
                </div>
                {!r ? <p style={S.empty}>Review probe not loaded.</p> : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 8 }}>
                    <div style={S.kv}><span>missing keys tracked</span><b>{String(!!r.missingKeysTracked)}</b></div>
                    <div style={S.kv}><span>fallback tracked</span><b>{String(!!r.fallbackUsageTracked)}</b></div>
                    <div style={S.kv}><span>review queue visible</span><b>{String(!!r.reviewQueueVisible)}</b></div>
                    {locs.map(([label, key]) => (
                      <div key={key} style={S.kv}>
                        <span>{label}</span>
                        <b style={{ color: PD[String(r[key] || 'UNKNOWN')] || '#94A3B8' }}>{String(r[key] || 'UNKNOWN')}</b>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })()}
          {[
            ['Language health', snap.language],
            ['Language state',  snap.state],
            ['Offline packs',   snap.offline],
            ['Voice alignment', snap.voice],
            ['Message templates', snap.templates],
          ].map(([label, obj]) => (
            <section key={label} style={S.card}>
              <div style={S.cardTitle}>{label}</div>
              <pre style={S.pre}>{_safe(() => JSON.stringify(obj, null, 2), '—')}</pre>
            </section>
          ))}
          <section style={{ ...S.card, gridColumn: '1 / -1' }}>
            <div style={S.cardTitle}>Translator review queue ({entries.length})</div>
            <pre style={S.pre}>{_safe(() => JSON.stringify(entries, null, 2), '—')}</pre>
          </section>
        </div>
      )}
    </main>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#0B1220', color: '#E5E7EB', padding: '24px 16px 80px',
    fontFamily: 'ui-monospace, monospace', maxWidth: 960, margin: '0 auto' },
  head: { display: 'flex', alignItems: 'center', gap: 12 },
  title: { fontSize: 20, fontWeight: 800, margin: 0, color: '#FFFFFF', fontFamily: 'system-ui' },
  sub: { fontSize: 13, color: '#94A3B8', margin: '8px 0 12px', fontFamily: 'system-ui' },
  btn: { appearance: 'none', border: '1px solid #334155', background: '#1E293B', color: '#E5E7EB',
    fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 10, cursor: 'pointer' },
  empty: { fontSize: 13, color: '#94A3B8', fontFamily: 'system-ui' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 },
  card: { background: '#111827', border: '1px solid #1F2937', borderRadius: 12, padding: '12px 14px' },
  cardTitle: { fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase',
    letterSpacing: '0.06em', marginBottom: 8, fontFamily: 'system-ui' },
  pre: { margin: 0, fontSize: 11, color: '#CBD5E1', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
    maxHeight: 360, overflow: 'auto' },
  kv: { display: 'flex', flexDirection: 'column', gap: 2, background: '#0F172A', border: '1px solid #1F2937',
    borderRadius: 8, padding: '8px 10px', fontSize: 11, color: '#94A3B8', fontFamily: 'system-ui' },
};
