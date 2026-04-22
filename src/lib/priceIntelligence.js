/**
 * priceIntelligence.js — client wrapper for the marketplace price
 * insights endpoint.
 *
 *   fetchPriceInsight({ crop, country?, region?, windowDays? })
 *     → Promise<PriceInsight | null>
 *
 *   formatPriceRange(insight, { lang, short })
 *     → string — '$0.12 – $0.35 / kg'
 *   formatTrend(insight, { lang })
 *     → { arrow: '↑|↓|→', label: 'Up this week' | ..., color }
 *
 * Throws nothing. Returns null + logs to console on failure so UI
 * can gracefully show "Market price not available yet."
 */

import { useEffect, useMemo, useState } from 'react';

async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

export async function fetchPriceInsight({ crop, country, region, windowDays } = {}) {
  if (!crop) return null;
  try {
    const qs = new URLSearchParams();
    qs.set('crop', String(crop).trim());
    if (country) qs.set('country', String(country).toUpperCase());
    if (region)  qs.set('region',  String(region));
    if (Number.isFinite(windowDays)) qs.set('windowDays', String(windowDays));
    const res = await fetch(`/api/marketplace/prices/insight?${qs}`, {
      credentials: 'include',
    });
    if (!res.ok) return null;
    const body = await safeJson(res);
    if (!body || body.success === false) return null;
    return body.data !== undefined ? body.data : body;
  } catch {
    return null;
  }
}

/**
 * usePriceInsight({ crop, country, region, windowDays })
 *   Hook. Re-fetches when any input changes. Returns
 *     { insight, loading, error, refresh }.
 */
export function usePriceInsight({ crop, country, region, windowDays = 30 } = {}) {
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(Boolean(crop));
  const [error,   setError]   = useState(null);
  const [nonce,   setNonce]   = useState(0);

  useEffect(() => {
    if (!crop) { setInsight(null); setLoading(false); return undefined; }
    let cancelled = false;
    setLoading(true); setError(null);
    fetchPriceInsight({ crop, country, region, windowDays }).then((out) => {
      if (cancelled) return;
      setInsight(out);
      if (!out) setError('unavailable');
      setLoading(false);
    }).catch((e) => {
      if (cancelled) return;
      setError(String(e && e.message || e));
      setInsight(null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [crop, country, region, windowDays, nonce]);

  const refresh = () => setNonce((x) => x + 1);
  return { insight, loading, error, refresh };
}

// ─── Display helpers ─────────────────────────────────────────
const CURRENCY_SYMBOLS = Object.freeze({
  USD: '$', GHS: 'GH\u20B5', NGN: '\u20A6', KES: 'KSh',
  INR: '\u20B9', TZS: 'TSh', UGX: 'USh', BRL: 'R$',
  EUR: '\u20AC', GBP: '\u00A3',
});
function symbol(currency) {
  return CURRENCY_SYMBOLS[String(currency || '').toUpperCase()] || `${currency || ''} `;
}

export function formatPriceRange(insight, { short = false } = {}) {
  if (!insight || !insight.suggested) return '';
  const s = symbol(insight.currency);
  const { low, high, typical } = insight.suggested;
  if (!Number.isFinite(low) || !Number.isFinite(high)) {
    return Number.isFinite(typical) ? `${s}${typical.toFixed(2)}/kg` : '';
  }
  if (short) return `${s}${low.toFixed(2)}\u2013${high.toFixed(2)}/kg`;
  return `${s}${low.toFixed(2)} \u2013 ${s}${high.toFixed(2)} / kg`;
}

export function formatTrend(insight) {
  if (!insight || !insight.trend) {
    return { arrow: '\u2192', label: null, color: '#CBD5E1' };
  }
  if (insight.trend === 'up')   return { arrow: '\u2191', label: 'up',     color: '#86EFAC' };
  if (insight.trend === 'down') return { arrow: '\u2193', label: 'down',   color: '#FCA5A5' };
  return                               { arrow: '\u2192', label: 'stable', color: '#CBD5E1' };
}

export const PRICE_SOURCE_LABELS = Object.freeze({
  local:    'Your region',
  country:  'Country average',
  global:   'Global benchmark',
  fallback: 'Generic estimate',
});
