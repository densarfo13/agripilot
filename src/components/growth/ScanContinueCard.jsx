/**
 * ScanContinueCard — habit-conversion CTA shown after a scan.
 *
 * Spec coverage (User acquisition §4)
 *   • Convert to habit: show daily task after scan.
 *
 * Behaviour
 *   • Mounts on the scan result card under the existing buttons.
 *   • Headline pulls the scan's plant/issue when available, falls
 *     back to a generic "you're set up" line for unknown crops.
 *   • Primary CTA routes to `/home` so the user lands on the
 *     daily plan with their fresh streak.
 *   • Self-suppresses behind `userAcquisition` flag.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Pure presentational; never throws.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import { trackEvent } from '../../analytics/analyticsStore.js';

const S = {
  card: {
    background: 'linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,197,94,0.08))',
    border: '1px solid #22C55E',
    borderRadius: 14,
    padding: '14px 16px',
    color: '#fff',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    boxShadow: '0 4px 18px rgba(34,197,94,0.18)',
    marginTop: 12,
  },
  icon: { fontSize: 26, lineHeight: 1, flex: '0 0 auto' },
  body: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 },
  eyebrow: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#86EFAC',
  },
  title: { fontSize: 15, fontWeight: 800, color: '#fff' },
  copy:  { fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 },
  cta: {
    appearance: 'none',
    border: 'none',
    background: '#22C55E',
    color: '#0B1D34',
    padding: '10px 14px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: 6,
    alignSelf: 'flex-start',
  },
};

/**
 * @param {object} props
 * @param {object} [props.result]   scan result for context-aware copy
 * @param {string} [props.style]
 */
export default function ScanContinueCard({ result, style }) {
  useTranslation();
  const navigate = useNavigate();
  const flagOn = isFeatureEnabled('userAcquisition');

  const viewedRef = useRef(false);
  useEffect(() => {
    if (!flagOn) return;
    if (viewedRef.current) return;
    viewedRef.current = true;
    try { trackEvent('scan_continue_view', {}); }
    catch { /* swallow */ }
  }, [flagOn]);

  const handleContinue = useCallback(() => {
    try { trackEvent('scan_continue_click', {}); }
    catch { /* swallow */ }
    try { navigate('/'); }
    catch { /* swallow */ }
  }, [navigate]);

  if (!flagOn) return null;

  const cropName = String(result?.crop || result?.plantId || '').trim();
  const cropDisplay = cropName
    ? cropName.charAt(0).toUpperCase() + cropName.slice(1)
    : '';

  return (
    <section
      style={{ ...S.card, ...(style || null) }}
      data-testid="scan-continue-card"
    >
      <span style={S.icon} aria-hidden="true">{'\uD83C\uDF31'}</span>
      <div style={S.body}>
        <span style={S.eyebrow}>
          {tStrict('growth.scanContinue.eyebrow', 'Next step')}
        </span>
        <span style={S.title}>
          {cropDisplay
            ? tStrict('growth.scanContinue.titleWithCrop',
                'Get your daily {crop} plan')
                .replace('{crop}', cropDisplay)
            : tStrict('growth.scanContinue.title',
                'Get your daily plan')}
        </span>
        <span style={S.copy}>
          {tStrict('growth.scanContinue.copy',
            'Open Farroway and we\u2019ll show you 1 priority action for today \u2014 it builds your streak.')}
        </span>
        <button
          type="button"
          onClick={handleContinue}
          style={S.cta}
          data-testid="scan-continue-cta"
        >
          {tStrict('growth.scanContinue.cta', 'Open my plan')}
        </button>
      </div>
    </section>
  );
}
