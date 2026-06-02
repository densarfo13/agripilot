/**
 * generate-scan-validation-report.mjs
 *
 * Produces SCAN_VALIDATION_REPORT.md from the live Prisma data
 * AND/OR from a baseline empty template when no DATABASE_URL is set.
 *
 * Designed to run:
 *   - Locally as `node scripts/generate-scan-validation-report.mjs`
 *   - Weekly via cron / GitHub Action / Railway scheduled task
 *
 * The report mirrors the /admin/scan-lab dashboard but persists to
 * disk so the team can diff week-over-week.
 *
 * NEVER throws. When the DB is unreachable, emits the
 * baseline template so the report file always exists.
 */
import fs from 'node:fs';
import path from 'node:path';

const REPORT_PATH = path.resolve(process.cwd(), 'SCAN_VALIDATION_REPORT.md');

function _fmtPct(n) {
  if (n == null) return '—';
  return Math.round(Number(n) * 10) / 10 + '%';
}

function _statusLine(label, value, target, higherIsBetter, unit = '%') {
  if (value == null) return '- ' + label + ': **Not enough data** (target ' + (higherIsBetter ? '>' : '<') + ' ' + target + unit + ')';
  const meets = higherIsBetter ? value > target : value < target;
  const badge = meets ? 'PASS' : 'BELOW TARGET';
  return '- ' + label + ': **' + _fmtPct(value) + '** — ' + badge
    + ' (target ' + (higherIsBetter ? '>' : '<') + ' ' + target + unit + ')';
}

function _emptyReport(reason) {
  const ts = new Date().toISOString();
  return [
    '# SCAN_VALIDATION_REPORT',
    '',
    '**Generated:** ' + ts,
    '',
    '_No live metrics available — ' + (reason || 'database unreachable') + '. ',
    'Once admins start labelling images at `/admin/scan-lab`, this',
    'report will fill in with real numbers._',
    '',
    '---',
    '',
    '## Spec Targets',
    '',
    '- Plant Accuracy > 85%',
    '- Disease Accuracy > 75%',
    '- Unknown Rate < 10%',
    '- Average Confidence > 70%',
    '',
    '## Status: PENDING DATA',
    '',
    '- Plant Accuracy: **Not enough data**',
    '- Disease Accuracy: **Not enough data**',
    '- Pest Accuracy: **Not enough data**',
    '- Unknown Rate: **Not enough data**',
    '- Average Confidence: **Not enough data**',
    '',
    '---',
    '',
    '_Decision support, not a guarantee._',
    '',
  ].join('\n');
}

async function _tryComputeFromDb() {
  if (!process.env.DATABASE_URL) {
    return { ok: false, reason: 'DATABASE_URL not set' };
  }
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const { computeMetrics, computeTopFailures, computeCalibration } =
      await import('../server/src/ml/scanValidationMetrics.js');
    const [m7, m30, failures, calibration] = await Promise.all([
      computeMetrics(prisma,    { days: 7 }),
      computeMetrics(prisma,    { days: 30 }),
      computeTopFailures(prisma, { days: 30, limit: 10 }),
      computeCalibration(prisma, { days: 30 }),
    ]);
    await prisma.$disconnect();
    return { ok: true, m7, m30, failures, calibration };
  } catch (err) {
    return { ok: false, reason: (err && err.message) || 'prisma_error' };
  }
}

function _formatReport(data) {
  const ts = new Date().toISOString();
  const { m7, m30, failures, calibration } = data;
  const lines = [];
  lines.push('# SCAN_VALIDATION_REPORT');
  lines.push('');
  lines.push('**Generated:** ' + ts);
  lines.push('');
  lines.push('## 7-Day Window');
  lines.push('');
  lines.push(_statusLine('Plant Accuracy',     m7.plantAccuracyPct,    85, true));
  lines.push(_statusLine('Disease Accuracy',   m7.diseaseAccuracyPct,  75, true));
  lines.push(_statusLine('Pest Accuracy',      m7.pestAccuracyPct,     70, true));
  lines.push(_statusLine('Unknown Rate',       m7.unknownRatePct,      10, false));
  lines.push(_statusLine('False Positive %',   m7.falsePositivePct,    15, false));
  lines.push(_statusLine('Average Confidence', m7.averageConfidencePct, 70, true));
  lines.push('');
  lines.push('- Total validations: **' + (m7.totalValidations || 0) + '**');
  lines.push('- Labeled: **' + (m7.labeledCount || 0) + '**');
  if (m7.confidenceInflationPct != null) {
    lines.push('- Confidence inflation: **'
      + (m7.confidenceInflationPct > 0 ? '+' : '')
      + m7.confidenceInflationPct
      + '** (positive = model overclaims)');
  }
  lines.push('');
  lines.push('## 30-Day Window');
  lines.push('');
  lines.push(_statusLine('Plant Accuracy',     m30.plantAccuracyPct,    85, true));
  lines.push(_statusLine('Disease Accuracy',   m30.diseaseAccuracyPct,  75, true));
  lines.push(_statusLine('Pest Accuracy',      m30.pestAccuracyPct,     70, true));
  lines.push(_statusLine('Unknown Rate',       m30.unknownRatePct,      10, false));
  lines.push(_statusLine('False Positive %',   m30.falsePositivePct,    15, false));
  lines.push(_statusLine('Average Confidence', m30.averageConfidencePct, 70, true));
  lines.push('');
  lines.push('- Total validations: **' + (m30.totalValidations || 0) + '**');
  lines.push('- Labeled: **' + (m30.labeledCount || 0) + '**');
  lines.push('');

  if (failures && failures.ok) {
    lines.push('## Top Failures (30 days)');
    lines.push('');
    const _emit = (title, rows) => {
      lines.push('### ' + title);
      if (rows.length === 0) {
        lines.push('- None');
      } else {
        for (const r of rows) {
          lines.push('- `' + (r.predicted || '∅') + '` → `'
            + (r.actual || '∅') + '` × **' + r.count + '**');
        }
      }
      lines.push('');
    };
    _emit('Plants',   failures.plants);
    _emit('Diseases', failures.diseases);
    _emit('Pests',    failures.pests);
  }

  if (calibration && calibration.ok) {
    lines.push('## Confidence Calibration (30 days)');
    lines.push('');
    lines.push('| Band | n | Accuracy | Inflation |');
    lines.push('|---|---|---|---|');
    for (const b of calibration.buckets) {
      lines.push('| ' + b.band + ' | ' + b.n + ' | '
        + _fmtPct(b.accuracyPct) + ' | '
        + (b.inflation == null ? '—'
            : (b.inflation > 0 ? '+' : '') + b.inflation) + ' |');
    }
    lines.push('');
    lines.push('_Inflation = bucket midpoint − actual accuracy. ' +
      'Positive numbers indicate confidence inflation._');
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('_Decision support, not a guarantee._');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const dbResult = await _tryComputeFromDb();
  const report = dbResult.ok ? _formatReport(dbResult) : _emptyReport(dbResult.reason);
  try {
    fs.writeFileSync(REPORT_PATH, report, 'utf8');
    console.log('[scan-validation-report] wrote ' + REPORT_PATH
      + ' (' + report.length + ' bytes)');
  } catch (err) {
    console.error('[scan-validation-report] write failed:', err && err.message);
    process.exit(1);
  }
}

main();
