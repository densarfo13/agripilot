/**
 * FundingEligibilityPrompt — FEATURE_ACTIVATION_POLISH funding nudge.
 *
 * Shown on /funding when the farmer has a crop on record but no region,
 * suggesting they add their region to unlock better recommendations.
 * Also shown as a fallback when no funding cards match at all.
 *
 * Rules
 * ─────
 *   • Hooks called unconditionally — rules-of-hooks safe.
 *   • Never throws.
 *   • No network, no blocking render.
 *   • Never claims specific eligibility or guaranteed funding.
 *
 * Props
 *   hasCrop      — boolean  farmer has a crop recorded
 *   hasRegion    — boolean  farmer has a country/region recorded
 *   onAddRegion  — () → void  navigate to profile/region setup
 */

import { useCallback } from 'react';

const S = {
  wrap: {
    background: 'rgba(34,197,94,0.05)',
    border: '1px solid rgba(34,197,94,0.22)',
    borderRadius: 12,
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  headline: {
    margin: 0,
    fontSize: 14,
    fontWeight: 800,
    color: '#86EFAC',
  },
  body: {
    margin: 0,
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 1.55,
  },
  btn: {
    marginTop: 4,
    appearance: 'none',
    border: '1px solid rgba(34,197,94,0.40)',
    background: 'transparent',
    color: '#86EFAC',
    fontWeight: 700,
    fontSize: 13,
    padding: '7px 14px',
    borderRadius: 8,
    cursor: 'pointer',
    fontFamily: 'inherit',
    alignSelf: 'flex-start',
  },
};

export default function FundingEligibilityPrompt({ hasCrop, hasRegion, onAddRegion }) {
  // Hooks unconditional — rules-of-hooks safe.
  const handleClick = useCallback(() => {
    if (typeof onAddRegion === 'function') {
      try { onAddRegion(); } catch { /* ignore */ }
    }
  }, [onAddRegion]);

  // Only show when there's at least a crop but no region — that's the
  // "you could get better results with more data" nudge. If neither
  // exists the parent shows the general empty state instead.
  if (!hasCrop || hasRegion) return null;

  return (
    <div style={S.wrap} data-testid="funding-eligibility-prompt">
      <p style={S.headline}>💡 You may be eligible for funding.</p>
      <p style={S.body}>
        Add your region to see programs available for your crop and location.
      </p>
      <button
        type="button"
        style={S.btn}
        data-testid="funding-eligibility-prompt-cta"
        onClick={handleClick}
      >
        Add region for better funding options
      </button>
    </div>
  );
}
