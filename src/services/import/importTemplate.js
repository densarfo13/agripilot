/**
 * importTemplate — build the canonical CSV template a partner downloads.
 *
 * Kept as data so it stays in sync with parseImportFile's HEADER_ALIASES
 * and validateFarmerImportRows' required fields.
 */

export const TEMPLATE_COLUMNS = [
  'full_name',
  'phone_number',
  'country',
  'region_or_state',
  'district',
  'village',
  'preferred_language',
  'crop',
  'land_size',
  'external_farmer_id',
];

const SAMPLE_ROW = {
  full_name: 'Ama Mensah',
  phone_number: '+233241234567',
  country: 'GH',
  region_or_state: 'Ashanti',
  district: 'Kumasi',
  village: 'Ayeduase',
  preferred_language: 'en',
  crop: 'MAIZE',
  land_size: '2',
  external_farmer_id: 'NGO-001',
};

/**
 * Return the CSV string for the template.
 */
export function buildTemplateCsv() {
  const header = TEMPLATE_COLUMNS.join(',');
  const sample = TEMPLATE_COLUMNS.map(col => SAMPLE_ROW[col] ?? '').join(',');
  return `${header}\n${sample}\n`;
}

/**
 * Trigger a browser download of the template.
 */
export function downloadTemplate(filename = 'farmer-import-template.csv') {
  const blob = new Blob([buildTemplateCsv()], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export error rows from an executed batch so the partner can fix and
 * re-upload. Accepts the `errors` + `perRow` arrays from executeFarmerImport.
 */
export function downloadErrorsCsv(results = [], filename = 'farmer-import-errors.csv') {
  const failed = results.filter(r => r.status === 'error' || r.importStatus === 'INVALID');
  if (failed.length === 0) return false;

  const header = [...TEMPLATE_COLUMNS, 'row', 'issues'].join(',');
  const body = failed.map(r => {
    const row = r.row;
    const cells = TEMPLATE_COLUMNS.map(c => csvCell(row[c]));
    cells.push(csvCell(row._rowNumber));
    cells.push(csvCell((r.issues || []).map(i => i.messageKey).join('; ')));
    return cells.join(',');
  });
  const csv = `${header}\n${body.join('\n')}\n`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

function csvCell(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
