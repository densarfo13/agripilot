/**
 * ScanModeSelector.jsx — SCAN TYPE ROUTER pre-scan quick modes.
 *
 * Before scanning, the farmer can tell us what they're pointing at:
 *   Auto-detect (default) · Scan Plant · Scan Leaf · Scan Fruit ·
 *   Scan Vegetable · Scan Insect · Scan Soil
 *
 * The chosen mode is passed as `scanMode` into analyzeScan so the router
 * routes correctly. Pure, never throws.
 */
import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { SCAN_MODES } from '../../runtime/scan/router/ScanTypeContracts';

const ICON = { auto: '✨', plant: '🌱', leaf: '🍃', fruit: '🍅', vegetable: '🥬', insect: '🐛', soil: '🟤' };
const FALLBACK = {
  auto: 'Auto-detect', plant: 'Scan Plant', leaf: 'Scan Leaf', fruit: 'Scan Fruit',
  vegetable: 'Scan Vegetable', insect: 'Scan Insect', soil: 'Scan Soil',
};

export default function ScanModeSelector({ value = 'auto', onChange }) {
  const pick = (m) => { try { if (onChange) onChange(m); } catch { /* swallow */ } };
  return (
    <div style={S.wrap} data-testid="scan-mode-selector" role="radiogroup"
      aria-label={tSafe('scanMode.aria', 'What are you scanning?')}>
      {SCAN_MODES.map((m) => {
        const active = value === m;
        return (
          <button
            key={m}
            type="button"
            data-mode={m}
            role="radio"
            aria-checked={active}
            onClick={() => pick(m)}
            style={{ ...S.chip, ...(active ? S.chipActive : null) }}
          >
            <span aria-hidden="true">{ICON[m]}</span>
            <span>{tSafe('scanMode.' + m, FALLBACK[m])}</span>
          </button>
        );
      })}
    </div>
  );
}

const S = {
  wrap: { display: 'flex', gap: 8, flexWrap: 'wrap', padding: '8px 0', fontFamily: 'system-ui' },
  chip: { display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 38,
    padding: '0 14px', borderRadius: 999, cursor: 'pointer',
    border: '1px solid rgba(60,72,55,0.2)', background: 'rgba(255,255,255,0.9)',
    color: '#2C3A26', fontSize: 13, fontWeight: 700 },
  chipActive: { background: '#2f7a3a', color: '#fff', borderColor: '#2f7a3a' },
};
