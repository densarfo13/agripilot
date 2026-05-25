/**
 * supplierPromptTemplate.js — supplier suggestion envelope.
 *
 * Honors the trust-label discipline: unverified suppliers never
 * imply endorsement.
 */

function _trust(t) {
  const v = String(t || 'unverified').toLowerCase();
  return ['verified', 'unverified', 'general'].includes(v) ? v : 'general';
}

export function supplierPromptTemplate(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const trust = _trust(c.trust);
    const category = c.category ? String(c.category) : '';
    const FALLBACK = {
      verified:   'Verified local supplier available for {category}.',
      unverified: 'A local supplier for {category} is listed — check before purchasing.',
      general:    'Check with a local agricultural supplier for {category}.',
    };
    return {
      key: 'intelligence.supplier.' + trust,
      fallback: FALLBACK[trust],
      params: { category, trust },
    };
  } catch {
    return {
      key: 'intelligence.supplier.general',
      fallback: 'Check with a local agricultural supplier.',
      params: {},
    };
  }
}

const _module = { supplierPromptTemplate };
export default _module;
