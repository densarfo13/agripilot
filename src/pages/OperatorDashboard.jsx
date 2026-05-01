/**
 * OperatorDashboard — operator-facing per-market control surface.
 *
 *   <Route path="/operator" element={<OperatorDashboard />} />
 *
 * Spec contract (Aggressive scaling §2, §4)
 *   §2 Operator tools — manage listings + connect buyers
 *   §4 Track per region — funnel cards driven by operatorMetrics
 *
 * Layout
 *   1. Header with active-market chip
 *   2. Per-market grid (one card per pilot market) — tap to focus
 *   3. Pending interests queue for the focused market
 *
 * Coexistence
 *   The page never replaces /admin/funding or /ngo/impact — it
 *   sits alongside those staff routes as a marketplace-specific
 *   operator surface. Existing role-guard handling on those
 *   routes is unchanged.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Self-hides behind the `operatorTools` flag — flag-off path
 *     renders a small "coming soon" notice so the route is
 *     always 404-safe (matches /buy pattern).
 *   • Reads only via the operatorMetrics aggregator + the
 *     marketResolver helpers; no new persistence keys.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../i18n/index.js';
import { tStrict } from '../i18n/strictT.js';
import { isFeatureEnabled } from '../config/features.js';
import { trackMarketEvent } from '../markets/marketAnalytics.js';
import { getMarketRegistry } from '../operator/operatorMetrics.js';
import {
  resolveActiveMarketId,
  ACTIVE_MARKET_CHANGED_EVENT,
} from '../markets/marketResolver.js';
import OperatorMarketCard from '../components/operator/OperatorMarketCard.jsx';
import OperatorInterestQueue from '../components/operator/OperatorInterestQueue.jsx';

function _safeReadJson(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch { return null; }
}

const S = {
  page: {
    minHeight: '100vh',
    background: '#0B1D34',
    color: '#fff',
    padding: '20px 16px 96px',
    maxWidth: 980,
    margin: '0 auto',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
    letterSpacing: '-0.01em',
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 1.45,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 10,
  },
  comingSoon: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: '20px 16px',
    color: 'rgba(255,255,255,0.78)',
    textAlign: 'center',
    fontSize: 14,
  },
};

export default function OperatorDashboard() {
  useTranslation();
  const flagOn = isFeatureEnabled('operatorTools');
  const [tick, setTick] = useState(0);
  const [focusId, setFocusId] = useState(() => {
    if (!flagOn) return null;
    try {
      return resolveActiveMarketId({
        profile:    _safeReadJson('farroway_user_profile') || {},
        activeFarm: _safeReadJson('farroway_active_farm'),
      });
    } catch { return null; }
  });

  // Re-render on cross-component change events so the funnel
  // cards stay live as new listings + interests arrive.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = () => setTick((n) => (n + 1) % 1_000_000);
    const evts = [
      'farroway:market_changed',
      ACTIVE_MARKET_CHANGED_EVENT,
      'storage',
    ];
    try { for (const e of evts) window.addEventListener(e, handler); }
    catch { /* swallow */ }
    return () => {
      try { for (const e of evts) window.removeEventListener(e, handler); }
      catch { /* swallow */ }
    };
  }, []);

  const registry = useMemo(() => {
    if (!flagOn) return [];
    try { return getMarketRegistry(); }
    catch { return []; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagOn, tick]);

  // One-shot view event when the flag is on so dashboards can
  // chart operator engagement.
  useEffect(() => {
    if (!flagOn) return;
    try { trackMarketEvent('operator_dashboard_view', {}); }
    catch { /* swallow */ }
  }, [flagOn]);

  if (!flagOn) {
    return (
      <main style={S.page} data-screen="operator-coming-soon">
        <h1 style={S.title}>
          {tStrict('operator.title', 'Operator dashboard')}
        </h1>
        <div style={S.comingSoon}>
          {tStrict('operator.comingSoon',
            'Operator tools are rolling out. Check back shortly.')}
        </div>
      </main>
    );
  }

  return (
    <main style={S.page} data-screen="operator-dashboard">
      <div>
        <h1 style={S.title}>
          {tStrict('operator.title', 'Operator dashboard')}
        </h1>
        <p style={S.subtitle}>
          {tStrict(
            'operator.subtitle',
            'Per-market funnel and pending interests. Tap a market to focus.',
          )}
        </p>
      </div>

      <section style={S.grid} data-testid="operator-market-grid">
        {registry.map((market) => (
          <OperatorMarketCard
            key={market.id}
            market={market}
            active={focusId === market.id}
            onSelect={() => {
              setFocusId(market.id);
              try {
                trackMarketEvent('operator_market_focused', { id: market.id });
              } catch { /* swallow */ }
            }}
          />
        ))}
      </section>

      {focusId ? (
        <OperatorInterestQueue marketId={focusId} />
      ) : null}
    </main>
  );
}
