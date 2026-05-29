/**
 * src/runtime/reports/ExportService.ts — CSV export. PDF
 * deferred until an existing PDF utility ships.
 */

export const EXPORT_SERVICE_VERSION = 'export-service-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _csvCell(v: unknown): string {
  const s = _str(v == null ? '' : String(v));
  if (s.indexOf(',') < 0 && s.indexOf('"') < 0 && s.indexOf('\n') < 0) {
    return s;
  }
  return '"' + s.replace(/"/g, '""') + '"';
}

/**
 * Convert a report's `metrics` object into a 2-column CSV
 * (metric, value). Empty metrics still emit a header so the
 * file is never blank.
 */
export function exportReportCSV(report: any): string {
  return _safe(() => {
    if (!_isObj(report)) return 'metric,value\n';
    const metrics = (report as any).metrics;
    const lines = ['metric,value'];
    if (_isObj(metrics)) {
      for (const k of Object.keys(metrics)) {
        lines.push(_csvCell(k) + ',' + _csvCell((metrics as any)[k]));
      }
    }
    // Trailer rows surface report metadata so the file is
    // self-describing.
    lines.push('');
    lines.push('# reportId,' + _csvCell(_str((report as any).reportId)));
    lines.push('# type,' + _csvCell(_str((report as any).type)));
    lines.push('# organizationId,' + _csvCell(_str((report as any).organizationId)));
    lines.push('# generatedAt,' + _csvCell(_str((report as any).generatedAt)));
    return lines.join('\n');
  }, 'metric,value\n');
}
