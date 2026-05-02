/**
 * ScanLocalExpertCTA — "Confirm with a local expert" prompt
 * shown when the verdict is risky enough to warrant a human
 * second opinion (advanced ML scan spec §5).
 *
 *   <ScanLocalExpertCTA
 *     confidence="medium"
 *     issue="Possible fungal stress"
 *     spreadFast={result.spreadFast}
 *     cropName={result.cropName}
 *   />
 *
 * Visibility rules (spec §5)
 *   * spreadFast === true                      → show
 *   * confidence !== 'high'                    → show
 *   * isHighValueCrop(cropName) === true       → show
 *   * none of the above → render null
 *
 * The CTA is informational — taps fire an analytics event +
 * navigate to /help (existing route). No backend call.
 *
 * Strict-rule audit
 *   * All visible text via tStrict.
 *   * Inline styles only.
 *   * Never throws.
 *   * Renders null when not relevant.
 */

import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { trackEvent } from '../../analytics/analyticsStore.js';

// Crops where a misdiagnosis is expensive enough to justify
// the extra friction of an expert check. Conservative list —
// trim or extend per market.
const HIGH_VALUE_CROPS = new Set([
  'cocoa', 'coffee', 'cashew', 'mango', 'avocado',
  'tomato', 'pepper', 'chili', 'cucumber',
  'cassava', 'yam', 'plantain', 'banana',
  'maize', 'rice', 'soy', 'soybean',
]);

function _isHighValueCrop(name) {
  if (!name) return false;
  const s = String(name).toLowerCase().trim();
  if (HIGH_VALUE_CROPS.has(s)) return true;
  for (const k of HIGH_VALUE_CROPS) {
    if (s.includes(k)) return true;
  }
  return false;
}

const C = {
  ink:     '#EAF2FF',
  inkSoft: 'rgba(255,255,255,0.65)',
  amber:   '#F59E0B',
  amberBg: 'rgba(245,158,11,0.10)',
  amberBd: 'rgba(245,158,11,0.32)',
};

const S = {
  card: {
    background: C.amberBg,
    border: `1px solid ${C.amberBd}`,
    borderRadius: 14,
    padding: '14px 16px',
    margin: '12px 0',
    color: C.ink,
  },
  eyebrow: { fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: C.amber },
  title:   { margin: '4px 0 6px', fontSize: 14, fontWeight: 800 },
  body:    { margin: '0 0 10px', fontSize: 13, color: C.inkSoft, lineHeight: 1.5 },
  cta: {
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    background: C.amber,
    color: '#3B2F0E',
    border: 'none',
    padding: '10px 14px',
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 800,
    minHeight: 40,
  },
};

export default function ScanLocalExpertCTA({
  confidence, issue, spreadFast, cropName,
}) {
  useTranslation();
  const navigate = useNavigate();

  const tier = String(confidence || '').toLowerCase();
  const lowOrMedium = tier !== 'high';
  const showForCrop = _isHighValueCrop(cropName);

  // Spec §5: any one of the three triggers shows the CTA.
  const show = !!spreadFast || lowOrMedium || showForCrop;
  if (!show) return null;

  const reasons = [];
  if (spreadFast)  reasons.push('spread');
  if (lowOrMedium) reasons.push('confidence');
  if (showForCrop) reasons.push('high_value_crop');

  function handleTap() {
    try { trackEvent('scan_expert_cta_tap', { issue, tier, reasons }); }
    catch { /* swallow */ }
    try { navigate('/help'); }
    catch { /* swallow */ }
  }

  return (
    <section
      style={S.card}
      data-testid="scan-expert-cta"
      data-reasons={reasons.join(',')}
    >
      <span style={S.eyebrow}>
        {tStrict('scan.expert.eyebrow', 'Want a second opinion?')}
      </span>
      <h3 style={S.title}>
        {tStrict('scan.expert.title', 'Confirm with a local expert')}
      </h3>
      <p style={S.body}>
        {tStrict('scan.expert.body',
          'For severe or fast-spreading issues, a local extension officer or experienced grower can confirm what to do next.')}
      </p>
      <button
        type="button"
        onClick={handleTap}
        style={S.cta}
        data-testid="scan-expert-cta-tap"
      >
        {tStrict('scan.expert.cta', 'Find local help')}
      </button>
    </section>
  );
}

export const _internal = Object.freeze({ HIGH_VALUE_CROPS, _isHighValueCrop });
