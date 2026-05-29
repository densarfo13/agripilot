// server/src/modules/organization/onboarding/csvTemplate.js
//
// Wave 17 — CSV template generator for the bulk farmer onboarding
// download. The frontend "Download Template" button calls into
// this module to obtain the canonical header row + 2 safe example
// rows.
//
// The header row contains all 17 spec columns (2 hard-required +
// 2 either-required + 13 optional) in the same order the
// importer normalizes them. Example rows use deliberately
// non-real placeholders ("Sample One", "555-EXAMPLE", "user@
// example.test") so that a downloaded template never resembles
// real PII and can be safely shared between organizations.
//
// Strict-rule audit
//   • Pure. No persistence. No fetch. No PII.
//   • Examples MUST NOT use real-looking E.164 numbers or real
//     consumer-mail domains (gmail / yahoo / outlook / hotmail /
//     icloud). The check-bulk-onboarding-security gate enforces
//     this with regex.

export const CSV_TEMPLATE_VERSION =
  'farroway-bulk-onboarding-csv-template-v1';

// All 17 columns in canonical order. Keep this list in lockstep
// with REQUIRED_CSV_COLUMNS + OPTIONAL_CSV_COLUMNS in
// src/runtime/organization/onboarding/onboardingContracts.ts.
export const CSV_TEMPLATE_COLUMNS = Object.freeze([
  'first_name',
  'last_name',
  'phone',
  'email',
  'age_range',
  'gender',
  'country',
  'region',
  'district',
  'village',
  'farm_size',
  'primary_crop',
  'secondary_crop',
  'program',
  'cohort',
  'field_officer_email',
  'consent_for_program_reporting',
]);

// Safe example rows. The phone column intentionally contains
// letters so the gate's E.164 detector cannot match it; the
// email column uses the IETF-reserved example.test domain.
const EXAMPLE_ROWS = Object.freeze([
  Object.freeze({
    first_name: 'Sample',
    last_name: 'One',
    phone: 'PLACEHOLDER-PHONE-1',
    email: 'sample.one@example.test',
    age_range: '25-34',
    gender: 'female',
    country: 'KE',
    region: 'Central',
    district: 'Kiambu',
    village: 'Sample Village A',
    farm_size: '0.5',
    primary_crop: 'maize',
    secondary_crop: 'beans',
    program: 'Demo Program',
    cohort: 'Demo Cohort 1',
    field_officer_email: 'officer.placeholder@example.test',
    consent_for_program_reporting: 'true',
  }),
  Object.freeze({
    first_name: 'Sample',
    last_name: 'Two',
    phone: 'PLACEHOLDER-PHONE-2',
    email: 'sample.two@example.test',
    age_range: '35-44',
    gender: 'male',
    country: 'KE',
    region: 'Central',
    district: 'Kiambu',
    village: 'Sample Village B',
    farm_size: '1.2',
    primary_crop: 'sorghum',
    secondary_crop: '',
    program: 'Demo Program',
    cohort: 'Demo Cohort 2',
    field_officer_email: 'officer.placeholder@example.test',
    consent_for_program_reporting: 'false',
  }),
]);

// Escapes a single CSV cell value per RFC 4180.
function escapeCell(value) {
  const s = value == null ? '' : String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// Builds the canonical CSV template body. Always returns CRLF
// line endings to match Excel's expectations and reduce parser
// surprises.
export function buildCsvTemplate() {
  const header = CSV_TEMPLATE_COLUMNS.join(',');
  const rows = EXAMPLE_ROWS.map((row) =>
    CSV_TEMPLATE_COLUMNS.map((col) => escapeCell(row[col])).join(',')
  );
  return [header, ...rows].join('\r\n') + '\r\n';
}

export function getCsvTemplateColumns() {
  return CSV_TEMPLATE_COLUMNS;
}

export function getCsvTemplateExamples() {
  return EXAMPLE_ROWS;
}

export default buildCsvTemplate;
