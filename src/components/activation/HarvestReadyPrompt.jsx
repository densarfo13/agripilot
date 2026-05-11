/**
 * HarvestReadyPrompt — FEATURE_ACTIVATION_POLISH "Ready to sell?" banner.
 *
 * Shown on /sell when the farmer's active farm crop stage indicates
 * the crop is at or near harvest. Self-hides when stage is not
 * harvest-ready. Does NOT force any action.
 *
 * Stage detection reads from localStorage('farroway_active_farm').cropStage.
 * Harvest-ready stages: harvest, post_harvest, ready_to_sell, ready,
 * harvest_ready, harvesting.
 *
 * Rules
 * ─────
 *   • Hooks called unconditionally — rules-of-hooks safe.
 *   • Never throws — localStorage read is guarded.
 *   • Returns null when stage is not harvest-ready (no render).
 *   • No network, no blocking render, no forced redirect.
 *
 * Props
 *   profile       — ProfileContext profile object (for cropStage fallback)
 *   onListClick   — () → void  optional; scrolls to / focuses the form
 */

import { useMemo } from 'react';
import { WheatGlyph } from '../icons/InlineGlyphs.jsx';

const HARVEST_STAGES = new Set([
  'harvest',
  'post_harvest',
  'ready_to_sell',
  'ready',
  'harvest_ready',
  'harvesting',
]);

function _readStage(profile) {
  // 1. Try localStorage active farm (most reliable).
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('farroway_active_farm');
      if (raw) {
        const farm = JSON.parse(raw);
        const stage = farm?.cropStage || farm?.stage || farm?.farmStage;
        if (stage) return String(stage).toLowerCase();
      }
    }
  } catch { /* fall through */ }
  // 2. Fallback to profile prop.
  try {
    const stage = profile?.cropStage || profile?.stage;
    if (stage) return String(stage).toLowerCase();
  } catch { /* fall through */ }
  return null;
}

const S = {
  banner: {
    background: 'rgba(200,148,77,0.07)',
    border: '1px solid rgba(200,148,77,0.28)',
    borderRadius: 12,
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  },
  icon: { fontSize: 22, flexShrink: 0, lineHeight: 1.3 },
  body: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 },
  headline: {
    margin: 0,
    fontSize: 14,
    fontWeight: 800,
    color: '#86EFAC',
  },
  text: {
    margin: 0,
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 1.5,
  },
  btn: {
    marginTop: 6,
    appearance: 'none',
    border: '1px solid rgba(200,148,77,0.45)',
    background: 'transparent',
    color: '#86EFAC',
    fontWeight: 700,
    fontSize: 13,
    padding: '6px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    fontFamily: 'inherit',
    alignSelf: 'flex-start',
  },
};

export default function HarvestReadyPrompt({ profile, onListClick }) {
  // All hooks unconditional.
  const stage = useMemo(() => _readStage(profile), [profile]);
  const isHarvestReady = HARVEST_STAGES.has(stage || '');

  // Self-hide when not harvest-ready.
  if (!isHarvestReady) return null;

  return (
    <div style={S.banner} data-testid="harvest-ready-prompt">
      <span aria-hidden="true" style={S.icon}><WheatGlyph size={24} /></span>
      <div style={S.body}>
        <p style={S.headline}>Ready to sell?</p>
        <p style={S.text}>
          Your crop looks ready to harvest. List it here so buyers can find you.
        </p>
        {typeof onListClick === 'function' ? (
          <button
            type="button"
            style={S.btn}
            data-testid="harvest-ready-prompt-cta"
            onClick={() => { try { onListClick(); } catch { /* ignore */ } }}
          >
            List produce now
          </button>
        ) : null}
      </div>
    </div>
  );
}
