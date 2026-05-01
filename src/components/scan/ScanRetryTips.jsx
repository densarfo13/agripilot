/**
 * ScanRetryTips — "tips for a clearer photo" block shown after a
 * scan with low confidence or an unsure fallback diagnosis.
 *
 * Spec coverage (Robust journey §4)
 *   • Unclear results → retry tips.
 *
 * When it shows
 *   • result.confidence is finite AND < 0.6, OR
 *   • result.kind === 'fallback' / result.fallback === true, OR
 *   • result.possibleIssue empty + no diagnosis text.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Self-suppresses behind `journeyResilience` flag.
 *   • Never throws.
 */

import { useCallback } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import { trackEvent } from '../../analytics/analyticsStore.js';

const TIPS = [
  { key: 'journey.scan.tip.lighting', fallback: 'Use natural light \u2014 avoid harsh shadows.' },
  { key: 'journey.scan.tip.focus',    fallback: 'Hold steady; focus on a single leaf or area.' },
  { key: 'journey.scan.tip.distance', fallback: 'Get close enough to see leaf detail clearly.' },
  { key: 'journey.scan.tip.clean',    fallback: 'Wipe the camera lens if it\u2019s dirty.' },
];

const S = {
  card: {
    background: 'rgba(252,211,77,0.10)',
    border: '1px solid rgba(252,211,77,0.40)',
    borderRadius: 12,
    padding: '12px 14px',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 12,
  },
  headRow: { display: 'flex', alignItems: 'center', gap: 8 },
  title: { margin: 0, fontSize: 14, fontWeight: 800, color: '#FDE68A' },
  copy:  { margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 },
  list:  { margin: 0, paddingLeft: 18, fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 },
  rowBtns: { display: 'flex', gap: 8, marginTop: 4 },
  primary: {
    appearance: 'none',
    border: 'none',
    background: '#FCD34D',
    color: '#0B1D34',
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

function _looksUnclear(result) {
  if (!result) return false;
  // Explicit fallback flags from the engine.
  if (result.fallback === true) return true;
  if (result.kind === 'fallback') return true;
  // Confidence threshold.
  const c = Number(result.confidence);
  if (Number.isFinite(c) && c < 0.6) return true;
  // No issue text + no diagnosis at all.
  const hasIssue = !!(result.possibleIssue || result.issue || result.diagnosis);
  if (!hasIssue) return true;
  return false;
}

/**
 * @param {object} props
 * @param {object} [props.result]
 * @param {() => void} [props.onRetake]
 */
export default function ScanRetryTips({ result, onRetake }) {
  useTranslation();
  const flagOn = isFeatureEnabled('journeyResilience');

  const handleRetake = useCallback(() => {
    try { trackEvent('journey_scan_retry_clicked', {}); }
    catch { /* swallow */ }
    if (typeof onRetake === 'function') {
      try { onRetake(); } catch { /* swallow */ }
    }
  }, [onRetake]);

  if (!flagOn) return null;
  if (!_looksUnclear(result)) return null;

  return (
    <section style={S.card} data-testid="scan-retry-tips">
      <div style={S.headRow}>
        <span aria-hidden="true">{'\uD83D\uDCA1'}</span>
        <h4 style={S.title}>
          {tStrict('journey.scan.tips.title', 'Tips for a clearer photo')}
        </h4>
      </div>
      <p style={S.copy}>
        {tStrict('journey.scan.tips.copy',
          'The result wasn\u2019t crisp. A second photo with these tips usually helps.')}
      </p>
      <ul style={S.list}>
        {TIPS.map((t) => (
          <li key={t.key}>{tStrict(t.key, t.fallback)}</li>
        ))}
      </ul>
      {typeof onRetake === 'function' ? (
        <div style={S.rowBtns}>
          <button
            type="button"
            onClick={handleRetake}
            style={S.primary}
            data-testid="scan-retry-tips-retake"
          >
            {tStrict('journey.scan.tips.retake', 'Take another photo')}
          </button>
        </div>
      ) : null}
    </section>
  );
}
