/**
 * validateFarmerImportRows — classify each normalized row as
 * valid / warning / error and attach localized issue keys.
 *
 * Pure. Callers render `row.issues[].messageKey` through t().
 */

import { getCropDefinition } from '../../engine/cropDefinitions.js';

const SUPPORTED_LANGUAGES = new Set(['en', 'fr', 'sw', 'ha', 'tw']);

/**
 * Validate a single row. Returns { status, issues }.
 *   status: 'valid' | 'warning' | 'error'
 *   issues: Array<{ field, level, messageKey }>
 */
export function validateRow(row) {
  const issues = [];

  // Required fields
  if (!row.full_name) issues.push({ field: 'full_name', level: 'error', messageKey: 'import.issue.missingName' });
  if (!row.phone_number) {
    issues.push({ field: 'phone_number', level: 'error', messageKey: 'import.issue.missingPhone' });
  } else if (row.phone_number.replace(/\D/g, '').length < 7) {
    issues.push({ field: 'phone_number', level: 'error', messageKey: 'import.issue.invalidPhone' });
  }
  if (!row.country) issues.push({ field: 'country', level: 'error', messageKey: 'import.issue.missingCountry' });
  if (!row.region_or_state) issues.push({ field: 'region_or_state', level: 'error', messageKey: 'import.issue.missingRegion' });

  // Soft warnings for optional fields that we received but couldn't understand
  if (row.crop && !getCropDefinition(row.crop)) {
    issues.push({ field: 'crop', level: 'warning', messageKey: 'import.issue.unknownCrop' });
  }
  if (row.preferred_language && !SUPPORTED_LANGUAGES.has(row.preferred_language)) {
    issues.push({ field: 'preferred_language', level: 'warning', messageKey: 'import.issue.unknownLanguage' });
  }

  const hasError = issues.some(i => i.level === 'error');
  const hasWarning = issues.some(i => i.level === 'warning');
  const status = hasError ? 'error' : hasWarning ? 'warning' : 'valid';

  return { status, issues };
}

/**
 * Validate a whole row list + surface duplicate detection by phone
 * and external_farmer_id within the uploaded file itself.
 */
export function validateFarmerImportRows(rows = []) {
  // Per-row validation
  const results = rows.map(row => {
    const { status, issues } = validateRow(row);
    return { row, status, issues };
  });

  // In-file duplicates — priority 1: external_farmer_id, 2: phone
  const byExternalId = new Map();
  const byPhone = new Map();
  for (const r of results) {
    const eid = r.row.external_farmer_id;
    if (eid) {
      if (!byExternalId.has(eid)) byExternalId.set(eid, []);
      byExternalId.get(eid).push(r);
    }
    const phone = r.row.phone_number;
    if (phone) {
      if (!byPhone.has(phone)) byPhone.set(phone, []);
      byPhone.get(phone).push(r);
    }
  }

  for (const group of [...byExternalId.values(), ...byPhone.values()]) {
    if (group.length < 2) continue;
    // Mark every duplicate occurrence after the first
    for (let i = 1; i < group.length; i++) {
      const r = group[i];
      r.status = r.status === 'error' ? 'error' : 'duplicate_in_file';
      r.issues.push({ field: 'phone_number', level: 'warning', messageKey: 'import.issue.duplicateInFile' });
    }
  }

  const counts = {
    total: results.length,
    valid: results.filter(r => r.status === 'valid').length,
    warning: results.filter(r => r.status === 'warning').length,
    error: results.filter(r => r.status === 'error').length,
    duplicateInFile: results.filter(r => r.status === 'duplicate_in_file').length,
  };

  return { results, counts };
}
