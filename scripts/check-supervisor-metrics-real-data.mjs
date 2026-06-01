#!/usr/bin/env node
/**
 * check-supervisor-metrics-real-data.mjs — supervisor metrics MUST use
 * real data only. Locks the contract that null = NEEDS_DATA and never
 * a hardcoded fallback percentage / count.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const fails = [];
const read = (rel) => {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { fails.push(`missing: ${rel}`); return ''; }
  return fs.readFileSync(p, 'utf8');
};

const f = 'src/runtime/fieldOfficer/FieldOfficerSupervisorMetrics.ts';
const src = read(f);
if (src) {
  const required = [
    '__fieldOfficerSupervisorMetricsHealth',
    'installFieldOfficerSupervisorMetricsGlobal',
    'fieldOfficersTotal', 'farmersPerOfficer',
    'followUpCompletionRate', 'outcomeCaptureRate',
    'averageResponseTimeHours',
    'highRiskFarmersByOfficer', 'overdueInterventionsByOfficer',
    'supervisorMetricsReady',
    'realDataOnly: true as const',
    'orgScoped: true as const',
    'insufficientDataHandled: true as const',
  ];
  for (const k of required) {
    if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
  }
  // _pctOrNull must return null when denominator missing — locks the
  // "no fake percentages" rule.
  if (src.indexOf('_pctOrNull') < 0)
    fails.push(`${f}: must define _pctOrNull helper`);
  // Forbid hardcoded fallback percentages like `?? 50` or `|| 75`.
  if (/(?:\?\?|\|\|)\s*\d{2,3}\s*[,;)]/.test(src)) {
    fails.push(`${f}: forbidden hardcoded percentage fallback — null = NEEDS_DATA only`);
  }
}

// Page must show "Null values mean no data" disclosure.
{
  const f = 'src/pages/FieldOfficerPage.jsx';
  const src = read(f);
  if (src && src.indexOf('fieldOfficer.note.honest') < 0)
    fails.push(`${f}: must display "Null = no data ingested yet" note`);
}

if (fails.length) {
  console.error('[check:supervisor-metrics-real-data] FAILED');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:supervisor-metrics-real-data] OK');
