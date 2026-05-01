/**
 * RegionDetectChip — replaces the static `Region: …` pill on the
 * Sell form with a smart variant:
 *
 *   • Detected region exists → show "Greater Accra, Ghana" + a
 *     small "Detected" tag.
 *   • Detection failed / unsupported → show "Set your location"
 *     button that calls back to the parent (typically navigates
 *     to /profile/setup or invokes a re-detect).
 *
 * Spec coverage (Sell screen V2 §3)
 *   • show detected city/state
 *   • fallback to "Set your location"
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Pure — region detection lives in `useDetectedRegion`.
 *   • Never throws.
 */

import { useEffect } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import useDetectedRegion from '../../hooks/useDetectedRegion.js';

const S = {
  pill: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '10px 12px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    fontSize: 13,
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.6)',
  },
  value: { color: '#fff', fontWeight: 700 },
  detectedTag: {
    fontSize: 10,
    fontWeight: 700,
    color: '#86EFAC',
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.30)',
    padding: '2px 6px',
    borderRadius: 999,
  },
  setBtn: {
    appearance: 'none',
    border: '1px solid rgba(252,211,77,0.40)',
    background: 'rgba(252,211,77,0.10)',
    color: '#FCD34D',
    padding: '6px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  rightCol: { display: 'flex', alignItems: 'center', gap: 8 },
};

/**
 * @param {object} props
 * @param {string} [props.initialRegion]
 * @param {string} [props.initialCountry]
 * @param {() => void} [props.onSetLocation]  caller's "Set your
 *   location" handler (typically navigates to profile setup).
 * @param {(region: string, country: string) => void} [props.onDetected]
 *   notified once a region resolves so the parent form can
 *   include it in the saved listing.
 */
export default function RegionDetectChip({
  initialRegion = '',
  initialCountry = '',
  onSetLocation,
  onDetected,
  style,
}) {
  useTranslation();
  const { region, country, status } = useDetectedRegion({
    initialRegion,
    initialCountry,
    autoDetect: true,
  });

  // Notify parent when detection resolves. Effect runs whenever
  // status flips to 'detected' or the resolved region/country
  // changes — never during render.
  useEffect(() => {
    if (typeof onDetected !== 'function') return;
    if (status !== 'detected') return;
    if (!region && !country) return;
    try { onDetected(region, country); } catch { /* swallow */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, region, country]);

  const showFallback = !region && (status === 'failed' || status === 'unsupported');
  const showDetecting = !region && status === 'detecting';

  return (
    <div style={{ ...S.pill, ...(style || null) }} data-testid="sell-region-detect">
      <span style={S.label}>
        {tStrict('sell.region.label', 'Region')}
      </span>

      {showFallback ? (
        <button
          type="button"
          onClick={onSetLocation}
          style={S.setBtn}
          data-testid="sell-region-set-cta"
        >
          {tStrict('sell.region.setLocation', 'Set your location')}
        </button>
      ) : showDetecting ? (
        <span style={{ ...S.value, color: 'rgba(255,255,255,0.65)' }} data-testid="sell-region-detecting">
          {tStrict('sell.region.detecting', 'Detecting\u2026')}
        </span>
      ) : (
        <span style={S.rightCol}>
          <span style={S.value} data-testid="sell-region-value">
            {region || country || '—'}
          </span>
          {status === 'detected' && (region || country) && !initialRegion ? (
            <span style={S.detectedTag} data-testid="sell-region-detected-tag">
              {tStrict('sell.region.detectedTag', 'Detected')}
            </span>
          ) : null}
        </span>
      )}
    </div>
  );
}
