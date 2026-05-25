/**
 * marketplacePromptTemplate.js — marketplace cue envelope.
 *
 * Never guarantees price or sale. Always hedged.
 */

function _kind(k) {
  const v = String(k || 'ready_to_sell').toLowerCase();
  return ['ready_to_sell', 'buyer_interest', 'price_range'].includes(v)
    ? v : 'ready_to_sell';
}

export function marketplacePromptTemplate(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const kind = _kind(c.kind);
    const crop = c.crop ? String(c.crop) : '';
    const FALLBACK = {
      ready_to_sell:  'Your {crop} may be ready to list — see what local buyers are looking for.',
      buyer_interest: 'Buyers viewed your {crop} listing recently — consider responding.',
      price_range:    'Recent local prices give a rough range for {crop} — see the listing screen.',
    };
    return {
      key: 'intelligence.marketplace.' + kind,
      fallback: FALLBACK[kind],
      params: { crop, kind },
    };
  } catch {
    return {
      key: 'intelligence.marketplace.ready_to_sell',
      fallback: 'Check the marketplace for your crop.',
      params: {},
    };
  }
}

const _module = { marketplacePromptTemplate };
export default _module;
