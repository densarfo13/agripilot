/**
 * HarvestReadyPrompt — FEATURE_ACTIVATION_POLISH "Ready to sell?" banner.
 *
 * Triggered when EITHER:
 *   1. The active farm's crop stage is in HARVEST_STAGES   — OR —
 *   2. The latest produce scan envelope says marketReadiness
 *      is 'market_ready' or 'sell_soon'.
 *
 * The scan-intel trigger is more authoritative — a real produce
 * scan that found ripe + low-defect lots is stronger evidence than
 * a self-reported stage label. When both fire, the scan copy wins.
 *
 * Rules
 * ─────
 *   • Hooks called unconditionally — rules-of-hooks safe.
 *   • Never throws — localStorage reads are guarded.
 *   • Returns null when neither trigger applies (no render).
 *   • No network, no blocking render, no forced redirect.
 *
 * Props
 *   profile       — ProfileContext profile object (for cropStage fallback)
 *   onListClick   — () → void  optional; scrolls to / focuses the form
 */

import { WheatGlyph } from '../icons/InlineGlyphs.jsx';
import { readLatestProduceIntel } from '../../features/scan/produceIntelMemory.js';

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

function _readScanTrigger() {
  try {
    const latest = readLatestProduceIntel();
    if (!latest || !latest.intel) return null;
    const m = latest.intel.marketReadiness;
    if (m === 'market_ready' || m === 'sell_soon') {
      return {
        crop:            latest.crop,
        marketReadiness: m,
        suggestedWindow: latest.intel.sellFlow && latest.intel.sellFlow.suggestedWindowDays || 0,
      };
    }
    return null;
  } catch { return null; }
}

export default function HarvestReadyPrompt({ profile, onListClick }) {
  // Synchronous derivations — no memoization needed (both reads
  // are cheap localStorage lookups + return primitives).
  const stage = _readStage(profile);
  const scanTrigger = _readScanTrigger();
  const isHarvestReady = HARVEST_STAGES.has(stage || '') || scanTrigger !== null;

  if (!isHarvestReady) return null;

  // Scan-driven copy wins — it cites the specific crop.
  const headline = scanTrigger
    ? (scanTrigger.marketReadiness === 'market_ready'
        ? 'Your produce appears market ready'
        : 'Your produce is ready to sell soon')
    : 'Ready to sell?';

  const text = scanTrigger
    ? `Your last scan suggests this is a good window to list${
        scanTrigger.crop ? ' your ' + scanTrigger.crop : ''
      }. Open the form below to share it with buyers.`
    : 'Your crop looks ready to harvest. List it here so buyers can find you.';

  return (
    <div style={S.banner} data-testid="harvest-ready-prompt">
      <span aria-hidden="true" style={S.icon}><WheatGlyph size={24} /></span>
      <div style={S.body}>
        <p style={S.headline}>{headline}</p>
        <p style={S.text}>{text}</p>
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
