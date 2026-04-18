/**
 * normalizeFarmerImportRows — clean + canonicalize parsed rows so
 * downstream validation and matching see consistent data.
 *
 * Centralized here so any future API import path reuses the same
 * normalization and produces the same server-side result.
 */

// ─── Supported maps ────────────────────────────────────────

const LANG_ALIASES = {
  english: 'en', en: 'en',
  french: 'fr', francais: 'fr', français: 'fr', fr: 'fr',
  swahili: 'sw', kiswahili: 'sw', sw: 'sw',
  hausa: 'ha', ha: 'ha',
  twi: 'tw', akan: 'tw', tw: 'tw',
};

const CROP_ALIASES = {
  maize: 'MAIZE', corn: 'MAIZE',
  tomato: 'TOMATO', tomatoes: 'TOMATO',
  pepper: 'PEPPER', chilli: 'PEPPER', chili: 'PEPPER',
  onion: 'ONION', onions: 'ONION',
  cassava: 'CASSAVA', yucca: 'CASSAVA', manioc: 'CASSAVA',
  rice: 'RICE', paddy: 'RICE',
  bean: 'BEAN', beans: 'BEAN',
  coffee: 'COFFEE',
};

const GENDER_ALIASES = {
  m: 'male', male: 'male', man: 'male',
  f: 'female', female: 'female', woman: 'female',
  other: 'other',
  'prefer not to say': 'prefer_not_to_say', prefernotosay: 'prefer_not_to_say',
};

// ─── Helpers ───────────────────────────────────────────────

/**
 * Normalize a phone number to E.164-ish form.
 *   - strips whitespace, dashes, parentheses
 *   - keeps a leading + if present
 *   - returns '' if nothing numeric remains
 *
 * We do NOT guess a country code — that stays explicit via the country
 * column. A phone without a leading + is kept as digits; the server
 * applies country-specific prefix rules during the final save.
 */
export function normalizePhone(raw) {
  if (!raw) return '';
  const cleaned = String(raw).replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+')) return '+' + cleaned.slice(1).replace(/\D/g, '');
  return cleaned.replace(/\D/g, '');
}

function normalizeCountry(raw) {
  if (!raw) return '';
  const v = String(raw).trim();
  // Two-letter code → upper; free-form → Title Case
  if (v.length === 2) return v.toUpperCase();
  return v.replace(/\w\S*/g, s => s[0].toUpperCase() + s.slice(1).toLowerCase());
}

function normalizeRegion(raw) {
  if (!raw) return '';
  return String(raw).trim().replace(/\s+/g, ' ');
}

function normalizeCrop(raw) {
  if (!raw) return '';
  const key = String(raw).trim().toLowerCase();
  return CROP_ALIASES[key] || String(raw).trim().toUpperCase();
}

function normalizeLanguage(raw) {
  if (!raw) return '';
  const key = String(raw).trim().toLowerCase();
  return LANG_ALIASES[key] || '';
}

function normalizeGender(raw) {
  if (!raw) return '';
  const key = String(raw).trim().toLowerCase();
  return GENDER_ALIASES[key] || '';
}

function normalizeLandSize(raw) {
  if (!raw) return '';
  const num = parseFloat(String(raw).replace(/,/g, '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(num) ? String(num) : '';
}

// ─── Public API ────────────────────────────────────────────

/**
 * Normalize a full list of parsed rows. Returns a new array; rows are
 * never mutated in place so the original parsed data can still be
 * shown to the operator as a raw preview.
 */
export function normalizeFarmerImportRows(rows = []) {
  return rows.map(row => ({
    _rowNumber: row._rowNumber,
    full_name: String(row.full_name || '').trim().replace(/\s+/g, ' '),
    phone_number: normalizePhone(row.phone_number),
    country: normalizeCountry(row.country),
    region_or_state: normalizeRegion(row.region_or_state),
    district: String(row.district || '').trim(),
    village: String(row.village || '').trim(),
    preferred_language: normalizeLanguage(row.preferred_language),
    crop: normalizeCrop(row.crop),
    land_size: normalizeLandSize(row.land_size),
    gender: normalizeGender(row.gender),
    age_range: String(row.age_range || '').trim(),
    organization_id: String(row.organization_id || '').trim(),
    external_farmer_id: String(row.external_farmer_id || '').trim(),
    notes: String(row.notes || '').trim(),
  }));
}

export const _internal = {
  normalizeCountry, normalizeRegion, normalizeCrop,
  normalizeLanguage, normalizeGender, normalizeLandSize,
};
