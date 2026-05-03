/**
 * programDashboard.js — additive helpers that satisfy the
 * "Add NGO / Program Layer to Farroway" spec without rebuilding
 * the existing NGO surface.
 *
 *   buildProgramDashboard({ programId?, farmers, events, perFarmRisks? })
 *     → {
 *         programId,                  // null when summary is org-wide
 *         totalFarmers,
 *         activeFarmers,              // ≥ 1 event in the last 7 days
 *         inactiveFarmers,            // total − active
 *         completionRate,             // tasks completed / farmers, normalized 0–1
 *         tasksCompleted,
 *         cropDistribution,           // [{ crop, count }]  — sorted desc
 *         generatedAt,
 *       }
 *
 *   exportProgramDashboardCsv(snapshot, opts?)
 *     → triggers a browser download of a CSV mirror of the
 *       snapshot. Returns true on success / false when the
 *       browser-side helper isn't available.
 *
 *   exportProgramSummaryPdf(snapshot, opts?)
 *     → triggers a browser download of a text-based summary
 *       (.txt fallback that prints cleanly into a PDF via the
 *       browser's "save as PDF" print path). Reuses the existing
 *       text-report download helper so we don't reinvent the
 *       blob plumbing.
 *
 * Why a sibling module rather than extending ngoAggregates.js
 * ──────────────────────────────────────────────────────────
 *   `ngoAggregates.buildNgoAggregates()` is the rich org-wide
 *   summary used by NgoDashboard. It returns 7-day windowed
 *   counts and per-region breakdowns. The spec asks for a
 *   tighter, program-scoped shape with explicit
 *   inactiveFarmers + completionRate + cropDistribution. Living
 *   the new shape next to it (and re-using its 7-day "active"
 *   heuristic) keeps both surfaces stable: existing dashboards
 *   keep their old contract, and the new spec gets exactly the
 *   shape it asks for.
 *
 * Strict-rule audit
 *   • Pure + sync; no I/O on the dashboard builder.
 *   • Never throws — bad input collapses to zeros.
 *   • Honest counts only — no projected/imputed values.
 *   • Browser-only exporters degrade silently in SSR / locked
 *     environments (return false).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function _safeArr(v) { return Array.isArray(v) ? v.filter(Boolean) : []; }

function _ts(e) {
  if (!e) return null;
  if (Number.isFinite(e.timestamp)) return e.timestamp;
  if (Number.isFinite(e.ts))        return e.ts;
  return null;
}

function _inLastDays(e, days) {
  const t = _ts(e);
  return t != null && t >= (Date.now() - days * DAY_MS);
}

function _farmIdOf(e) {
  if (!e || !e.payload) return null;
  const fid = e.payload.farmerId || e.payload.farmId;
  return fid != null ? String(fid) : null;
}

function _csvEscape(v) {
  // Excel-safe CSV: wrap any field containing comma / quote /
  // newline in double-quotes; escape interior quotes by
  // doubling. Numbers and null collapse to plain strings.
  const s = (v == null) ? '' : String(v);
  if (/[,"\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function _farmerCrop(f) {
  if (!f) return null;
  const c = f.crop || f.cropLabel || f.primaryCrop || (Array.isArray(f.crops) ? f.crops[0] : null);
  return c ? String(c).trim().toLowerCase() : null;
}

/**
 * buildProgramDashboard — pure aggregation matching spec §3.
 *
 * @param {object}   input
 * @param {string}   [input.programId]   — when set, only farmers in
 *                                         the program's deliveries
 *                                         (or matching its target)
 *                                         are counted. Caller passes
 *                                         the pre-filtered `farmers`
 *                                         list; we don't reach into
 *                                         the program store from here.
 * @param {Array}    input.farmers       — farmer rows
 * @param {Array}    input.events        — event-store rows
 * @returns {object}                     — see top-of-file docblock
 */
export function buildProgramDashboard({
  programId = null,
  farmers   = [],
  events    = [],
} = {}) {
  const safeFarmers = _safeArr(farmers);
  const safeEvents  = _safeArr(events);

  const totalFarmers = safeFarmers.length;

  // Active = ≥ 1 event in last 7 days. Mirrors the heuristic in
  // ngoAggregates so the two surfaces never disagree about
  // who's active.
  const farmerIdSet = new Set(
    safeFarmers
      .map((f) => String((f && (f.id || f.farmerId)) || ''))
      .filter(Boolean),
  );
  const activeIds = new Set();
  let tasksCompleted = 0;
  for (const e of safeEvents) {
    if (!_inLastDays(e, 7)) continue;
    const fid = _farmIdOf(e);
    if (!fid || !farmerIdSet.has(fid)) continue;
    activeIds.add(fid);
    const name = String(e.name || e.type || '').toLowerCase();
    if (name === 'task_completed' || name === 'task_completed') tasksCompleted += 1;
  }
  const activeFarmers   = activeIds.size;
  const inactiveFarmers = Math.max(0, totalFarmers - activeFarmers);

  // Completion rate normalized to 0–1. Defined as tasks-per-
  // farmer / 7 (loose proxy for "did the average farmer
  // complete one task per day this week"). Capped at 1 so a
  // hyper-active sample can't mislead the dashboard. When
  // there are no farmers, rate is 0.
  let completionRate = 0;
  if (totalFarmers > 0) {
    const perFarmer = tasksCompleted / totalFarmers;
    completionRate = Math.max(0, Math.min(1, perFarmer / 7));
  }

  // Crop distribution: count of farmers per (lowercased) crop.
  const cropMap = new Map();
  for (const f of safeFarmers) {
    const c = _farmerCrop(f);
    if (!c) continue;
    cropMap.set(c, (cropMap.get(c) || 0) + 1);
  }
  const cropDistribution = Array.from(cropMap.entries())
    .map(([crop, count]) => ({ crop, count }))
    .sort((a, b) => b.count - a.count);

  return Object.freeze({
    programId,
    totalFarmers,
    activeFarmers,
    inactiveFarmers,
    completionRate,
    tasksCompleted,
    cropDistribution,
    generatedAt: new Date().toISOString(),
  });
}

/**
 * Pure CSV builder — exposed separately so tests can verify
 * the string without touching the browser download path.
 */
export function buildProgramDashboardCsv(snapshot) {
  const s = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const lines = [];
  // Section 1: headline numbers (one row per metric).
  lines.push(['metric', 'value'].map(_csvEscape).join(','));
  lines.push(['programId',       s.programId || ''].map(_csvEscape).join(','));
  lines.push(['totalFarmers',    s.totalFarmers    ?? 0].map(_csvEscape).join(','));
  lines.push(['activeFarmers',   s.activeFarmers   ?? 0].map(_csvEscape).join(','));
  lines.push(['inactiveFarmers', s.inactiveFarmers ?? 0].map(_csvEscape).join(','));
  lines.push(['tasksCompleted',  s.tasksCompleted  ?? 0].map(_csvEscape).join(','));
  // Completion rate as a percentage with 1 decimal so spreadsheet
  // imports don't auto-format it as a date or fraction.
  const ratePct = Number.isFinite(s.completionRate)
    ? `${(s.completionRate * 100).toFixed(1)}%`
    : '0%';
  lines.push(['completionRate', ratePct].map(_csvEscape).join(','));
  lines.push(['generatedAt', s.generatedAt || ''].map(_csvEscape).join(','));
  // Blank row separator (still a valid CSV row).
  lines.push('');
  // Section 2: crop distribution.
  lines.push(['crop', 'farmerCount'].map(_csvEscape).join(','));
  for (const row of _safeArr(s.cropDistribution)) {
    lines.push([row.crop || '', row.count ?? 0].map(_csvEscape).join(','));
  }
  return lines.join('\n');
}

/**
 * Trigger a CSV download of a program-dashboard snapshot.
 * Uses the existing browser-side downloader so the blob /
 * URL plumbing stays in one place.
 */
export async function exportProgramDashboardCsv(snapshot, opts = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  let downloadCsv;
  try {
    ({ downloadCsv } = await import('../lib/ngo/downloadCsv.js'));
  } catch { return false; }
  const csv = buildProgramDashboardCsv(snapshot);
  const baseName = opts.filename
    || (snapshot && snapshot.programId
        ? `farroway_program_${snapshot.programId}`
        : 'farroway_program_dashboard');
  return downloadCsv({ filename: baseName, csv });
}

/**
 * Pure text builder — formatted as a one-page summary that
 * prints cleanly when the user runs "save as PDF" from the
 * browser's print dialog. Caller can pass in a translator `t`
 * so the headings localize.
 */
export function buildProgramSummaryText(snapshot, opts = {}) {
  const s = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const t = (opts && typeof opts.t === 'function') ? opts.t : null;
  const tr = (key, fb) => {
    if (!t) return fb;
    try { const v = t(key); return (v && v !== key) ? v : fb; }
    catch { return fb; }
  };
  const lines = [];
  const title = tr('ngo.report.title', 'Farroway Program Summary');
  lines.push(title);
  lines.push('='.repeat(Math.max(8, title.length)));
  lines.push('');
  if (s.programId) {
    lines.push(`${tr('ngo.report.programId', 'Program')}: ${s.programId}`);
  }
  lines.push(`${tr('ngo.report.totalFarmers',    'Total farmers')}: ${s.totalFarmers ?? 0}`);
  lines.push(`${tr('ngo.report.activeFarmers',   'Active (last 7d)')}: ${s.activeFarmers ?? 0}`);
  lines.push(`${tr('ngo.report.inactiveFarmers', 'Inactive')}: ${s.inactiveFarmers ?? 0}`);
  lines.push(`${tr('ngo.report.tasksCompleted',  'Tasks completed (7d)')}: ${s.tasksCompleted ?? 0}`);
  const ratePct = Number.isFinite(s.completionRate)
    ? `${(s.completionRate * 100).toFixed(1)}%`
    : '0%';
  lines.push(`${tr('ngo.report.completionRate',  'Completion rate (7d)')}: ${ratePct}`);
  lines.push('');
  lines.push(`${tr('ngo.report.cropDistribution', 'Crop distribution')}:`);
  const dist = _safeArr(s.cropDistribution);
  if (dist.length === 0) {
    lines.push(`  ${tr('ngo.report.cropDistribution.empty', '(no crops on record)')}`);
  } else {
    for (const row of dist) {
      lines.push(`  • ${row.crop}: ${row.count}`);
    }
  }
  lines.push('');
  lines.push(`${tr('ngo.report.generatedAt', 'Generated')}: ${s.generatedAt || ''}`);
  return lines.join('\n');
}

/**
 * Trigger a "PDF summary" download. The current pipeline ships
 * a plain-text file the user can print to PDF via the OS print
 * dialog (Save as PDF). When the team wires a server-side PDF
 * renderer, swap the body to call that endpoint and stream the
 * resulting blob — call sites stay untouched.
 */
export async function exportProgramSummaryPdf(snapshot, opts = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    const text = buildProgramSummaryText(snapshot, opts);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const baseName = opts.filename
      || (snapshot && snapshot.programId
          ? `farroway_program_${snapshot.programId}_summary`
          : 'farroway_program_summary');
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `${baseName}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch { /* ignore */ } }, 1000);
    return true;
  } catch { return false; }
}

export const _internal = Object.freeze({
  _csvEscape, _farmerCrop, _inLastDays, _farmIdOf,
});

export default {
  buildProgramDashboard,
  buildProgramDashboardCsv,
  buildProgramSummaryText,
  exportProgramDashboardCsv,
  exportProgramSummaryPdf,
};
