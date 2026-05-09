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

// Soft Ochre system + Sell refinement spec §9 (May 2026) —
// white-on-beige pill, ochre "Set region" CTA, growth-green
// "Detected" tag (genuine success signal). Region value stays
// crisp dark ink for legibility on the warm surface.
const S = {
  pill: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '10px 12px',
    borderRadius: 12,
    background: '#FFF9F0',
    border: '1px solid rgba(31,41,51,0.08)',
    fontSize: 13,
    boxShadow: '0 1px 0 0 rgba(255,255,255,0.55) inset',
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#667085',
  },
  value: { color: '#1F2933', fontWeight: 700 },
  detectedTag: {
    fontSize: 10,
    fontWeight: 700,
    color: '#3F6A3F',
    background: 'rgba(94,142,94,0.12)',
    border: '1px solid rgba(94,142,94,0.36)',
    padding: '2px 6px',
    borderRadius: 999,
  },
  // Soft-ochre "Set your location" CTA — replaces the legacy
  // amber pill so the call-to-action lives on the same accent
  // family as the rest of the page primary actions.
  setBtn: {
    appearance: 'none',
    border: '1px solid rgba(212,163,95,0.42)',
    background: 'rgba(212,163,95,0.12)',
    color: '#7A5A28',
    padding: '6px 12px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
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

  // Sell refinement spec §9 (May 2026) — defensive value
  // composition. The previous logic surfaced the literal "—"
  // em-dash next to a country code (visible as "REGION —, US")
  // when the detected region returned whitespace. We trim both
  // halves AND filter out any single-em-dash sentinel before
  // composing the display string. When both region and country
  // are empty, the chip flips to the "Region not set" + [Set
  // region] CTA path.
  const cleanRegion  = (region  || '').replace(/^\s*[—–-]\s*$/, '').trim();
  const cleanCountry = (country || '').replace(/^\s*[—–-]\s*$/, '').trim();
  const placeText = [cleanRegion, cleanCountry].filter(Boolean).join(', ');

  const showFallback = !placeText
    && (status === 'failed' || status === 'unsupported' || status === 'idle' || status === 'detected');
  const showDetecting = !placeText && status === 'detecting';

  return (
    <div style={{ ...S.pill, ...(style || null) }} data-testid="sell-region-detect">
      <span style={S.label}>
        {tStrict('sell.region.label', 'Region')}
      </span>

      {showFallback ? (
        <span style={S.rightCol}>
          <span
            style={{ ...S.value, color: '#667085', fontWeight: 600 }}
            data-testid="sell-region-not-set"
          >
            {tStrict('sell.regionNotSet', 'Region not set')}
          </span>
          <button
            type="button"
            onClick={onSetLocation}
            style={S.setBtn}
            data-testid="sell-region-set-cta"
          >
            {tStrict('sell.setRegion', 'Set region')}
          </button>
        </span>
      ) : showDetecting ? (
        <span style={{ ...S.value, color: '#667085' }} data-testid="sell-region-detecting">
          {tStrict('sell.region.detecting', 'Detecting\u2026')}
        </span>
      ) : (
        <span style={S.rightCol}>
          <span style={S.value} data-testid="sell-region-value">
            {placeText}
          </span>
          {status === 'detected' && placeText && !initialRegion ? (
            <span style={S.detectedTag} data-testid="sell-region-detected-tag">
              {tStrict('sell.region.detectedTag', 'Detected')}
            </span>
          ) : null}
        </span>
      )}
    </div>
  );
}
