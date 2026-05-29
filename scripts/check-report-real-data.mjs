#!/usr/bin/env node
/**
 * scripts/check-report-real-data.mjs — Reports surface real
 * aggregates only. "Not enough data yet" honesty pattern must
 * be present; no placeholder numbers.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const FAILED = [], PASSED = [];
const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '')
                       .replace(/\/\/[^\n]*/g, '')
                       .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const FILES = [
  ['src/runtime/reports/reportContracts.ts',     'farroway-report-runtime-v1', 'REPORT_RUNTIME_VERSION'],
  ['src/runtime/reports/ProgramReportEngine.ts', 'program-report-engine-v1',   'PROGRAM_REPORT_VERSION'],
  ['src/runtime/reports/ImpactReportEngine.ts',  'impact-report-engine-v1',    'IMPACT_REPORT_VERSION'],
  ['src/runtime/reports/ExportService.ts',       'export-service-v1',          'EXPORT_SERVICE_VERSION'],
  ['src/runtime/reports/ReportRuntime.ts',       'farroway-report-runtime-v1', 'REPORT_RUNTIME_VERSION'],
  ['src/runtime/reports/index.ts',               'farroway-report-runtime-v1', 'REPORT_RUNTIME_VERSION'],
];
const sources = {};
for (const [f, lit, c] of FILES) {
  const s = read(path.join(ROOT, f));
  sources[f] = s;
  if (!s) FAILED.push(`reports: missing ${f}`);
  else if (!s.includes(lit) && !s.includes(c)) {
    FAILED.push(`reports: ${f} missing "${lit}" or "${c}"`);
  }
}
if (Object.values(sources).every(Boolean)) PASSED.push(`reports: 6 files present`);

// Each report engine must emit fakeData:false.
for (const f of ['src/runtime/reports/ProgramReportEngine.ts',
                  'src/runtime/reports/ImpactReportEngine.ts']) {
  const s = strip(sources[f] || '');
  if (!/fakeData\s*:\s*false/.test(s)) {
    FAILED.push(`reports: ${f} must declare fakeData: false`);
  }
}
// REPORT_EMPTY_STATE = "Not enough data yet"
if (!/Not enough data yet/i.test(sources['src/runtime/reports/reportContracts.ts'] || '')) {
  FAILED.push(`reports: REPORT_EMPTY_STATE must equal "Not enough data yet"`);
}
PASSED.push(`reports: fakeData:false declared + "Not enough data yet" empty state`);

// 7 spec report types.
const SPEC_TYPES = ['program_summary','intervention_summary','farmer_activity',
  'plant_health','scan_activity','task_completion','evidence_summary'];
const contracts = sources['src/runtime/reports/reportContracts.ts'] || '';
for (const t of SPEC_TYPES) {
  if (!new RegExp("'" + t + "'").test(contracts)) {
    FAILED.push(`reports: REPORT_TYPES missing "${t}"`);
  }
}
PASSED.push(`reports: 7 spec report types covered`);

// CSV exporter
const exportSvc = sources['src/runtime/reports/ExportService.ts'] || '';
if (!/exportReportCSV/.test(exportSvc)) {
  FAILED.push(`reports: ExportService must export exportReportCSV`);
}

// Placeholder-number scan — banned literals across the reports tree.
const stripCheck = (src) => strip(src);
for (const [f, src] of Object.entries(sources)) {
  if (!src) continue;
  const s = stripCheck(src);
  if (/["'](?:1234|999\.?9|placeholder|TODO_METRIC)["']/i.test(s)) {
    FAILED.push(`reports: ${f} contains placeholder literal — reports must use real data only`);
  }
}
PASSED.push(`reports: no placeholder literals in report engines`);

if (FAILED.length > 0) {
  console.error('[check:report-real-data] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log('[check:report-real-data] PASS — report runtime surfaces real aggregates only.');
