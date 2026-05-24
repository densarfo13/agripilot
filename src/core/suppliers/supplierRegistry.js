/**
 * supplierRegistry.js — typed local-supplier registry.
 *
 *   import {
 *     listSuppliers, getSupplier, SUPPLIER_CATEGORY, SUPPLIER_STATUS,
 *   } from 'src/core/suppliers/supplierRegistry.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A typed, hand-curated registry of agricultural supplier
 *   profiles. Nothing live — entries ship as plain JS and surface
 *   adoption layers decide what (if any) to show.
 *
 *   It does NOT call out to any external API, does NOT pretend an
 *   unverified supplier is verified, and does NOT bake in any
 *   sponsorship. New entries land here with `verifiedStatus:
 *   'verified' | 'pending' | 'unverified'` so the trust label is
 *   always honest.
 *
 *   Data model — every entry MUST carry exactly these keys
 *   (`null` is allowed for unknown values, but no key is omitted):
 *
 *     {
 *       id, name, country, region, categories, cropsSupported,
 *       verifiedStatus, contactUrl, phone, distanceEstimate,
 *       lastVerifiedAt, notes
 *     }
 *
 *   Country codes follow ISO-3166-1 alpha-2. Regions follow the
 *   region key the rest of the app uses (e.g. 'ashanti', 'lagos').
 *
 * Strict-rule audit
 *   • Pure data + tiny helpers. Never throws. SSR-safe.
 */

export const SUPPLIER_CATEGORY = Object.freeze({
  SEEDS:         'seeds',
  SEEDLINGS:     'seedlings',
  COMPOST:       'compost',
  MULCH:         'mulch',
  ORGANIC_MATTER:'organic_matter',
  WATERING_TOOLS:'watering_tools',
  PRUNING_TOOLS: 'pruning_tools',
  STAKES:        'stakes',
  SOIL_TEST_KITS:'soil_test_kits',
  GLOVES:        'gloves',
  POTS_TRAYS:    'pots_trays',
  DRIP_SUPPLIES: 'drip_supplies',
  // Restricted — only surfaced behind safety guard.
  PESTICIDES:    'pesticides',
  HERBICIDES:    'herbicides',
  FUNGICIDES:    'fungicides',
  CHEMICAL_FERT: 'chemical_fertilizers',
});

export const SUPPLIER_STATUS = Object.freeze({
  VERIFIED:   'verified',
  PENDING:    'pending',
  UNVERIFIED: 'unverified',
});

// ── Registry ─────────────────────────────────────────────
// Hand-curated. New entries land as `unverified` until a partner
// review stamps them. The list intentionally starts SMALL — better
// to show a calm "Check with a local agricultural supplier" than
// a long list of unvetted names.
const _REGISTRY = Object.freeze([
  // Sample structure — replaced by partner-supplied data at
  // runtime via the regionConfig + adminOps routes. We ship NO
  // hand-picked "starter" suppliers because doing so risks
  // implicit endorsement of unvetted businesses.
]);

function _safe(v) { return v == null ? null : v; }

/**
 * List suppliers. By default returns ALL entries; pass a filter
 * to narrow by country / region / category / status / crop.
 *
 * @param {object} [filter]
 * @returns {Array<object>}
 */
export function listSuppliers(filter) {
  try {
    let out = _REGISTRY.slice();
    const f = filter || {};
    if (f.country)  out = out.filter((s) => s.country === f.country);
    if (f.region)   out = out.filter((s) => s.region  === f.region);
    if (f.status)   out = out.filter((s) => s.verifiedStatus === f.status);
    if (f.category) out = out.filter((s) => Array.isArray(s.categories) && s.categories.includes(f.category));
    if (f.crop)     out = out.filter((s) => Array.isArray(s.cropsSupported) && s.cropsSupported.includes(f.crop));
    // Verified first — defensive sort so the registry order can't
    // accidentally promote an unverified entry.
    out.sort((a, b) => {
      const _rank = (s) => s.verifiedStatus === SUPPLIER_STATUS.VERIFIED ? 0
                       : s.verifiedStatus === SUPPLIER_STATUS.PENDING    ? 1 : 2;
      const r = _rank(a) - _rank(b);
      if (r !== 0) return r;
      const da = Number(a.distanceEstimate);
      const db = Number(b.distanceEstimate);
      const aa = Number.isFinite(da) ? da : Infinity;
      const bb = Number.isFinite(db) ? db : Infinity;
      return aa - bb;
    });
    return out.map((s) => ({ ...s }));
  } catch { return []; }
}

export function getSupplier(id) {
  try {
    const e = _REGISTRY.find((s) => s && s.id === id);
    if (!e) return null;
    return { ...e };
  } catch { return null; }
}

/**
 * Normalise a candidate supplier entry into the canonical shape.
 * Used by the admin import path so partner-supplied rows always
 * land with the full key set.
 *
 * @param {object} raw
 * @returns {object|null}
 */
export function normaliseSupplier(raw) {
  try {
    if (!raw || typeof raw !== 'object') return null;
    if (!raw.id || !raw.name) return null;
    const status = Object.values(SUPPLIER_STATUS).includes(raw.verifiedStatus)
      ? raw.verifiedStatus
      : SUPPLIER_STATUS.UNVERIFIED;
    return {
      id:               String(raw.id),
      name:             String(raw.name),
      country:          _safe(raw.country),
      region:           _safe(raw.region),
      categories:       Array.isArray(raw.categories) ? raw.categories.slice() : [],
      cropsSupported:   Array.isArray(raw.cropsSupported) ? raw.cropsSupported.slice() : [],
      verifiedStatus:   status,
      contactUrl:       _safe(raw.contactUrl),
      phone:            _safe(raw.phone),
      distanceEstimate: _safe(raw.distanceEstimate),
      lastVerifiedAt:   _safe(raw.lastVerifiedAt),
      notes:            _safe(raw.notes),
    };
  } catch { return null; }
}

const _module = {
  SUPPLIER_CATEGORY, SUPPLIER_STATUS,
  listSuppliers, getSupplier, normaliseSupplier,
};
export default _module;
