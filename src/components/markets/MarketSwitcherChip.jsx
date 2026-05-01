/**
 * MarketSwitcherChip — small Home-mountable control showing the
 * currently active market with an inline dropdown to override.
 *
 * Spec coverage (Multi-market expansion §5)
 *   • Auto location detection (handled by resolver)
 *   • Manual override (this component is the UI surface)
 *
 * Behaviour
 *   • Renders a pill with country + currency + primary unit.
 *   • Tapping opens a tiny picker. Selecting a market calls
 *     `setActiveMarketId(id, { source: 'switcher' })` →
 *     fires `market_switched` analytics + emits the canonical
 *     change event so listeners (Buy.jsx, Insights, etc.)
 *     refresh.
 *   • "Auto-detect" option clears the override and lets the
 *     resolver fall back to country/profile detection.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Self-hides when `multiMarket` flag is off.
 *   • Never throws.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import {
  resolveActiveMarketId,
  setActiveMarketId,
  clearMarketOverride,
  getOverrideMarketId,
  getAllMarkets,
  ACTIVE_MARKET_CHANGED_EVENT,
} from '../../markets/marketResolver.js';

function _readActiveFarm() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('farroway_active_farm');
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : null;
  } catch { return null; }
}

function _readProfile() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('farroway_user_profile');
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : null;
  } catch { return null; }
}

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' },
  pill: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: 999,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  detectedTag: {
    fontSize: 9,
    fontWeight: 800,
    color: '#86EFAC',
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.30)',
    padding: '1px 6px',
    borderRadius: 999,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  picker: {
    background: '#162033',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 12,
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 220,
  },
  pickerRow: {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    padding: '8px 10px',
    borderRadius: 8,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  pickerRowActive: {
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.32)',
  },
  pickerRowAuto: {
    color: '#86EFAC',
    fontStyle: 'italic',
  },
  pickerHeading: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.6)',
    padding: '4px 10px',
  },
};

export default function MarketSwitcherChip({ style }) {
  useTranslation();
  const flagOn = isFeatureEnabled('multiMarket');
  const [, setTick] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = () => setTick((n) => (n + 1) % 1_000_000);
    try {
      window.addEventListener(ACTIVE_MARKET_CHANGED_EVENT, handler);
      window.addEventListener('storage', handler);
    } catch { /* swallow */ }
    return () => {
      try {
        window.removeEventListener(ACTIVE_MARKET_CHANGED_EVENT, handler);
        window.removeEventListener('storage', handler);
      } catch { /* swallow */ }
    };
  }, []);

  const { activeId, isOverride, market, allMarkets } = useMemo(() => {
    const id = resolveActiveMarketId({
      profile:    _readProfile() || {},
      activeFarm: _readActiveFarm(),
    });
    const m = getAllMarkets().find((x) => x.id === id) || null;
    return {
      activeId:   id,
      isOverride: !!getOverrideMarketId(),
      market:     m,
      allMarkets: getAllMarkets(),
    };
  }, []);

  const handlePick = useCallback((id) => {
    setActiveMarketId(id, { source: 'switcher' });
    setOpen(false);
  }, []);

  const handleAuto = useCallback(() => {
    clearMarketOverride();
    setOpen(false);
  }, []);

  if (!flagOn || !market) return null;

  const label = `${market.country} \u00B7 ${market.currency}`;

  return (
    <div style={{ ...S.wrap, ...(style || null) }} data-testid="market-switcher-chip">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={S.pill}
        data-testid="market-switcher-toggle"
        aria-haspopup="listbox"
        aria-expanded={open ? 'true' : 'false'}
      >
        <span aria-hidden="true">{'\uD83C\uDF0D'}</span>
        <span>{label}</span>
        {!isOverride ? (
          <span style={S.detectedTag}>
            {tStrict('multiMarket.auto', 'Auto')}
          </span>
        ) : null}
      </button>

      {open ? (
        <div style={S.picker} data-testid="market-switcher-picker">
          <span style={S.pickerHeading}>
            {tStrict('multiMarket.pickerHeading', 'Switch market')}
          </span>
          <button
            type="button"
            onClick={handleAuto}
            style={{ ...S.pickerRow, ...S.pickerRowAuto }}
            data-testid="market-switcher-auto"
          >
            <span aria-hidden="true">{'\uD83D\uDCCD'}</span>
            <span>{tStrict('multiMarket.autoOption', 'Auto-detect from location')}</span>
          </button>
          {allMarkets.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => handlePick(m.id)}
              style={{
                ...S.pickerRow,
                ...(activeId === m.id ? S.pickerRowActive : null),
              }}
              data-testid={`market-switcher-${m.id}`}
            >
              <span style={{ width: 28, fontWeight: 800, color: 'rgba(255,255,255,0.6)' }}>
                {m.id}
              </span>
              <span>{m.country}</span>
              <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
                {m.currency}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
