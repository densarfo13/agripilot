/**
 * MlBaselineWarning — small, calm banner that surfaces the
 * spec § 9 guardrail when an NGO surface displays an ML risk
 * number that came from a baseline / placeholder / stale model.
 *
 *   <MlBaselineWarning meta={mlRisk.meta} />
 *
 * Shape of `meta` (from src/ai/mlRiskEngine.computeMLRisk):
 *   {
 *     pestStatus:    { status, warning, datasetRows, ageDays, ... },
 *     droughtStatus: { status, warning, datasetRows, ageDays, ... },
 *     warning:       { messageKey, fallback } | null,
 *     isTrustworthy: boolean,
 *   }
 *
 * Render rules
 *   * meta.warning is null and isTrustworthy === true → render nothing
 *   * meta.warning is set → render a single calm banner with the
 *     translated message and (when known) the datasetRows count
 *   * Never shows raw weights, never shows accuracy / precision /
 *     recall numbers — those are model internals
 *
 * Strict-rule audit
 *   * Read-only, no API calls, no side effects
 *   * tSafe friendly: every visible string routes through tSafe
 *   * Never throws — defensive null-checks throughout
 *   * Coexists with src/ai/mlRiskEngine — does NOT make its own
 *     inference call
 */

import React from 'react';
import { tSafe } from '../i18n/tSafe.js';

export default function MlBaselineWarning({
  meta         = null,
  testIdPrefix = 'ml-baseline-warning',
}) {
  if (!meta || !meta.warning) return null;

  const w = meta.warning;
  const headline = tSafe(w.messageKey, w.fallback || 'Baseline model only.');

  // Pick a sensible per-domain hint when we know how many rows
  // backed the worst-status model. The user is meant to see
  // "trained on 137 examples" — NOT "weights = [0.04, ...]".
  const worstRows = (() => {
    const a = meta.pestStatus    && meta.pestStatus.datasetRows;
    const b = meta.droughtStatus && meta.droughtStatus.datasetRows;
    if (Number.isFinite(a) && Number.isFinite(b)) return Math.min(a, b);
    if (Number.isFinite(a)) return a;
    if (Number.isFinite(b)) return b;
    return null;
  })();

  const detail = worstRows != null
    ? tSafe('ml.baseline.detailRows',
            `Based on ${worstRows} labeled examples so far.`)
        .replace(/\{count\}/g, String(worstRows))
        .replace(/\$\{count\}/g, String(worstRows))
    : null;

  return (
    <div
      style={S.banner}
      role="status"
      aria-live="polite"
      data-testid={testIdPrefix}
    >
      <span style={S.icon} aria-hidden="true">{'\u26A0\uFE0F'}</span>
      <span style={S.text}>
        <strong style={S.headline}>{headline}</strong>
        {detail && (
          <span style={S.detail} data-testid={`${testIdPrefix}-detail`}>
            {' '}{detail}
          </span>
        )}
      </span>
    </div>
  );
}

const S = {
  banner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.625rem',
    background: 'rgba(245,158,11,0.08)',
    border: '1px solid rgba(245,158,11,0.30)',
    color: '#FCD34D',
    borderRadius: '10px',
    padding: '0.625rem 0.875rem',
    fontSize: '0.875rem',
    lineHeight: 1.45,
    margin: '0.5rem 0 0.75rem',
  },
  icon: {
    fontSize: '1rem',
    lineHeight: 1.45,
    flexShrink: 0,
  },
  text: {
    flex: 1,
    minWidth: 0,
    color: 'rgba(252,211,77,0.95)',
  },
  headline: {
    fontWeight: 700,
    color: '#FCD34D',
  },
  detail: {
    fontWeight: 400,
    color: 'rgba(252,211,77,0.78)',
  },
};
