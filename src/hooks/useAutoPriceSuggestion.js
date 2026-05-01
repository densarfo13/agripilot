/**
 * useAutoPriceSuggestion — react hook that resolves a suggested
 * price for the (crop, country) pair via the existing priceEngine.
 *
 *   const { suggestion, loading, formatted } = useAutoPriceSuggestion({
 *     crop:    'maize',
 *     country: 'Ghana',
 *   });
 *
 *   suggestion = { price, unit, currency, source } | null
 *   formatted  = '250 GHS / kg' | ''
 *
 * Strict-rule audit
 *   • Pure subscriber — `getReferencePrice` is sync, but we wrap
 *     it in a try/catch + memo so a future async swap is a 1-line
 *     change.
 *   • Never throws.
 *   • Returns null when the catalog has no entry for the pair —
 *     callers should treat null as "no suggestion, leave the
 *     field empty".
 */

import { useMemo } from 'react';
import { getReferencePrice } from '../lib/pricing/priceEngine.js';

function _formatSuggestion(s) {
  if (!s || !Number.isFinite(Number(s.price))) return '';
  const price = String(s.price);
  const cur = s.currency || '';
  const unit = s.unit || '';
  if (cur && unit)  return `${price} ${cur} / ${unit}`;
  if (cur)          return `${price} ${cur}`;
  if (unit)         return `${price} / ${unit}`;
  return price;
}

export default function useAutoPriceSuggestion({ crop, country } = {}) {
  const suggestion = useMemo(() => {
    if (!crop || !country) return null;
    try {
      const ref = getReferencePrice({ crop, country });
      if (!ref || !Number.isFinite(Number(ref.price))) return null;
      return ref;
    } catch { return null; }
  }, [crop, country]);

  const formatted = useMemo(() => _formatSuggestion(suggestion), [suggestion]);

  return { suggestion, formatted, loading: false };
}
