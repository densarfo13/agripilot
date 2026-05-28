/**
 * PriceSuggestionWidget — Phase 7A pricing hint inside the Sell form.
 *
 *   <PriceSuggestionWidget
 *     crop={crop}
 *     country={effectiveCountry}
 *     onAccept={(rangeStr) => setPriceRange(rangeStr)}
 *     accepted={priceSuggestionApplied}
 *   />
 *
 * Behaviour contract:
 *   • Fetches GET /api/v2/pricing/suggest?crop=...&country=...
 *   • Shows suggested range + confidence badge + "Use this price" button.
 *   • On API failure or noData → shows "Not enough local price data yet".
 *   • `onAccept` is called with the formatted price string; the parent
 *     sets priceRange and marks priceTouched so auto-suggestion stops.
 *   • `accepted=true` swaps the button for a "✓ Applied" label.
 *   • NEVER throws, NEVER blocks the listing form.
 *   • Pricing is purely informational — the farmer can ignore it.
 *
 * Strict-rule audit:
 *   • No PII — only crop + country sent, only aggregate returned.
 *   • No Redux / context coupling.
 *   • Every code path is null-safe.
 *   • Cancels the in-flight fetch when crop/country changes.
 */

import React, { useEffect, useRef, useState } from 'react';
import api from '../../runtime/apiRuntime.js';

// ── Confidence presentation ────────────────────────────────
const CONF = {
  high:   { color: '#4ade80', label: 'High confidence'   },
  medium: { color: '#fbbf24', label: 'Medium confidence' },
  low:    { color: '#94a3b8', label: 'Low confidence'    },
};

function getConf(c) { return CONF[c] || CONF.low; }

// ── Number formatter ──────────────────────────────────────
function fmt(n) {
  if (!Number.isFinite(n)) return '—';
  // Values below 1 show 2 decimal places; larger values are rounded.
  return n < 1 ? n.toFixed(2) : String(Math.round(n));
}

// Build a human-readable price range string.
function buildRangeStr(suggested, currency) {
  if (!suggested) return null;
  const { low, high } = suggested;
  if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
  const cur = currency || 'USD';
  return `${fmt(low)} – ${fmt(high)} ${cur} / kg`;
}

// ── Component ─────────────────────────────────────────────
export default function PriceSuggestionWidget({
  crop, country, onAccept, accepted,
}) {
  const [status, setStatus] = useState('idle');   // idle | loading | ready | nodata
  const [data,   setData]   = useState(null);
  const lastKey = useRef('');

  useEffect(() => {
    const cropStr    = String(crop    || '').trim();
    const countryStr = String(country || '').trim();

    // Nothing to fetch with no crop.
    if (!cropStr) {
      setStatus('idle');
      setData(null);
      return;
    }

    const key = `${cropStr}|${countryStr}`;
    // Avoid refetch when effective key hasn't changed (e.g. re-render).
    if (key === lastKey.current) return;
    lastKey.current = key;

    let cancelled = false;
    setStatus('loading');
    setData(null);

    (async () => {
      try {
        const params = new URLSearchParams({ crop: cropStr });
        if (countryStr) params.set('country', countryStr);
        const res = await api.get(`/v2/pricing/suggest?${params.toString()}`);
        if (cancelled) return;

        const d = res && res.data ? res.data : null;
        if (!d || d.noData) {
          setStatus('nodata');
        } else {
          setData(d);
          setStatus('ready');
        }
      } catch {
        if (!cancelled) setStatus('nodata');
      }
    })();

    return () => { cancelled = true; };
  }, [crop, country]);

  // ── Render states ─────────────────────────────────────

  // No crop yet — nothing to show.
  if (status === 'idle') return null;

  // Loading indicator — small + unobtrusive.
  if (status === 'loading') {
    return (
      <div style={S.wrap} data-testid="price-suggestion-loading">
        <span style={S.mutedText}>Fetching price data…</span>
      </div>
    );
  }

  // No data / error → spec fallback message.
  if (status === 'nodata' || !data) {
    return (
      <div style={S.wrap} data-testid="price-suggestion-nodata">
        <span style={S.mutedText}>
          Not enough local price data yet
        </span>
      </div>
    );
  }

  // ── Ready — real market data available ─────────────────
  const rangeStr = buildRangeStr(data.suggested, data.currency);

  // Edge case: malformed payload.
  if (!rangeStr) {
    return (
      <div style={S.wrap} data-testid="price-suggestion-norange">
        <span style={S.mutedText}>Not enough local price data yet</span>
      </div>
    );
  }

  const conf = getConf(data.confidence);
  const sampleSize = Number(data.sampleSize) || 0;
  const trendArrow = data.trend === 'up' ? '↑' : data.trend === 'down' ? '↓' : null;

  return (
    <div style={S.wrap} data-testid="price-suggestion-widget">

      {/* Header row: label + confidence badge */}
      <div style={S.headerRow}>
        <span style={S.headLabel}>Market price suggestion</span>
        <span
          style={{ ...S.confBadge, color: conf.color, borderColor: conf.color }}
          data-testid="price-suggestion-confidence"
        >
          {conf.label}
        </span>
      </div>

      {/* Price range + trend arrow + sample count */}
      <div style={S.rangeRow}>
        <span style={S.range} data-testid="price-suggestion-range">
          {rangeStr}
          {trendArrow ? (
            <span
              style={{
                marginLeft: 6,
                fontSize: 14,
                color: data.trend === 'up' ? '#4ade80' : '#f87171',
              }}
              aria-label={data.trend === 'up' ? 'price trending up' : 'price trending down'}
            >
              {trendArrow}
            </span>
          ) : null}
        </span>
        {sampleSize > 0 ? (
          <span style={S.sampleSize} data-testid="price-suggestion-samples">
            {sampleSize} listing{sampleSize !== 1 ? 's' : ''}
          </span>
        ) : null}
      </div>

      {/* Action: "Use this price" button or "✓ Applied" label */}
      {accepted ? (
        <span style={S.appliedLabel} data-testid="price-suggestion-applied">
          ✓ Applied to price field
        </span>
      ) : (
        <button
          type="button"
          style={S.useBtn}
          onClick={() => {
            if (typeof onAccept === 'function') onAccept(rangeStr);
          }}
          data-testid="price-suggestion-use-btn"
        >
          Use this price
        </button>
      )}

    </div>
  );
}

// ── Styles (matches Sell.jsx card palette) ─────────────────
const S = {
  wrap: {
    padding: '10px 12px',
    background: 'rgba(200,148,77,0.06)',
    border: '1px solid rgba(200,148,77,0.22)',
    borderRadius: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  headLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'rgba(255,255,255,0.6)',
  },
  confBadge: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    padding: '2px 7px',
    borderRadius: 999,
    border: '1px solid',
  },
  rangeRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
    flexWrap: 'wrap',
  },
  range: {
    fontSize: 15,
    fontWeight: 800,
    color: '#EAF2FF',
    letterSpacing: '-0.01em',
  },
  sampleSize: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
  useBtn: {
    alignSelf: 'flex-start',
    padding: '5px 13px',
    background: 'rgba(200,148,77,0.15)',
    border: '1px solid rgba(200,148,77,0.45)',
    borderRadius: 8,
    color: '#86EFAC',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 32,
  },
  appliedLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: '#86EFAC',
  },
  mutedText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    fontStyle: 'italic',
  },
};
