/**
 * weeklyReportEngine.js — compiles a decision-ready weekly NGO
 * report out of data Prisma already has. Pure, deterministic, no
 * side effects.
 *
 *   buildWeeklyReport({
 *     prisma,
 *     program,        // optional — scope everything to one program
 *     now,            // epoch ms
 *     windowDays,     // default 7
 *   }) → {
 *     meta:          { program, generatedAt, windowStart, windowEnd, windowDays },
 *     summary:       { totalFarmers, activeFarmers, inactiveFarmers,
 *                      taskCompletionRate, openIssues, resolvedIssues,
 *                      highRiskFarmers, changeVsPrior },
 *     activity:      { byDay:[{date,count}], topActive:[{farmerId,name,events}] },
 *     tasks:         { completed, assigned, rate },
 *     risk:          { distribution:{low,medium,high,critical},
 *                      topRiskyFarms:[{farmId,farmerName,score,level,reasons}] },
 *     needsAttention:[{ farmId, farmerName, reason, priority, daysSince }],
 *     actionsTaken:  [{ type, count, successRate }],
 *   }
 *
 * Safe: tolerates every Prisma model being partially missing —
 * returns zero-valued sections instead of throwing. NGOs see a
 * clean "nothing to report this week" block rather than an error.
 */

const DAY_MS = 24 * 3600 * 1000;

function startOfWindow(now, windowDays) {
  return now - Math.max(1, windowDays) * DAY_MS;
}

function safeInt(n) { return Number.isFinite(n) ? Math.round(n) : 0; }
function safePct(n) { return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; }

function pickName(row) {
  if (!row) return null;
  return row.fullName || row.farmerName || row.name
       || (row.farmer && (row.farmer.fullName || row.farmer.name))
       || null;
}

// ─── Section builders ────────────────────────────────────────────

async function buildSummary({ prisma, program, since, priorSince, now }) {
  const empty = {
    totalFarmers: 0, activeFarmers: 0, inactiveFarmers: 0,
    taskCompletionRate: 0, openIssues: 0, resolvedIssues: 0,
    highRiskFarmers: 0,
    changeVsPrior: { activeFarmers: 0, openIssues: 0, tasksCompleted: 0 },
  };
  if (!prisma) return empty;

  let totalFarmers = 0;
  try {
    const where = program ? { program } : {};
    if (prisma.farmer && typeof prisma.farmer.count === 'function') {
      totalFarmers = await prisma.farmer.count({ where });
    }
  } catch { /* leave as 0 */ }

  let activeFarmers = 0;
  let priorActiveFarmers = 0;
  try {
    if (prisma.farmEvent && typeof prisma.farmEvent.findMany === 'function') {
      const recent = await prisma.farmEvent.findMany({
        where: program
          ? { program, createdAt: { gte: new Date(since) } }
          : { createdAt: { gte: new Date(since) } },
        select: { farmerId: true, farmId: true, createdAt: true, type: true },
      });
      activeFarmers = new Set(recent.map((r) => r.farmerId || r.farmId).filter(Boolean)).size;
      const prior = await prisma.farmEvent.findMany({
        where: program
          ? { program, createdAt: { gte: new Date(priorSince), lt: new Date(since) } }
          : { createdAt: { gte: new Date(priorSince), lt: new Date(since) } },
        select: { farmerId: true, farmId: true },
      });
      priorActiveFarmers = new Set(prior.map((r) => r.farmerId || r.farmId).filter(Boolean)).size;
    }
  } catch { /* leave zeros */ }

  let completedTasks = 0;
  let priorCompletedTasks = 0;
  let totalAssigned = 0;
  try {
    if (prisma.farmTaskCompletion && typeof prisma.farmTaskCompletion.count === 'function') {
      completedTasks = await prisma.farmTaskCompletion.count({
        where: { completedAt: { gte: new Date(since) } },
      });
      priorCompletedTasks = await prisma.farmTaskCompletion.count({
        where: { completedAt: { gte: new Date(priorSince), lt: new Date(since) } },
      });
    }
    if (prisma.farmTaskAssignment && typeof prisma.farmTaskAssignment.count === 'function') {
      totalAssigned = await prisma.farmTaskAssignment.count({
        where: { createdAt: { gte: new Date(since) } },
      });
    }
  } catch { /* leave zeros */ }

  let openIssues = 0;
  let resolvedIssues = 0;
  let priorOpen = 0;
  try {
    if (prisma.issue && typeof prisma.issue.count === 'function') {
      openIssues      = await prisma.issue.count({ where: { status: { in: ['open', 'assigned', 'in_progress', 'escalated'] } } });
      resolvedIssues  = await prisma.issue.count({
        where: { status: 'resolved', updatedAt: { gte: new Date(since) } },
      });
      priorOpen = await prisma.issue.count({
        where: { status: { in: ['open', 'assigned', 'in_progress', 'escalated'] }, createdAt: { lt: new Date(since) } },
      });
    }
  } catch { /* leave zeros */ }

  let highRiskFarmers = 0;
  try {
    if (prisma.farmMetrics && typeof prisma.farmMetrics.findMany === 'function') {
      const rows = await prisma.farmMetrics.findMany({
        where: { metric: 'risk_score', capturedAt: { gte: new Date(since) } },
        orderBy: { capturedAt: 'desc' },
      });
      const latestByFarm = new Map();
      for (const r of rows) {
        if (!latestByFarm.has(r.farmId)) latestByFarm.set(r.farmId, r.value);
      }
      for (const v of latestByFarm.values()) if (v >= 60) highRiskFarmers += 1;
    }
  } catch { /* leave as 0 */ }

  const completionRate = totalAssigned > 0 ? completedTasks / totalAssigned
                       : (completedTasks > 0 ? 1 : 0);

  return {
    totalFarmers: safeInt(totalFarmers),
    activeFarmers: safeInt(activeFarmers),
    inactiveFarmers: Math.max(0, safeInt(totalFarmers) - safeInt(activeFarmers)),
    taskCompletionRate: safePct(completionRate),
    openIssues: safeInt(openIssues),
    resolvedIssues: safeInt(resolvedIssues),
    highRiskFarmers,
    changeVsPrior: {
      activeFarmers:  safeInt(activeFarmers) - safeInt(priorActiveFarmers),
      openIssues:     safeInt(openIssues)    - safeInt(priorOpen),
      tasksCompleted: safeInt(completedTasks) - safeInt(priorCompletedTasks),
    },
  };
}

async function buildActivity({ prisma, program, since, now }) {
  const empty = { byDay: [], topActive: [] };
  if (!prisma || !prisma.farmEvent) return empty;
  try {
    const rows = await prisma.farmEvent.findMany({
      where: program
        ? { program, createdAt: { gte: new Date(since) } }
        : { createdAt: { gte: new Date(since) } },
      select: { farmerId: true, farmId: true, createdAt: true, type: true },
    });

    const byDay = new Map();
    const byFarmer = new Map();
    for (const r of rows) {
      const day = new Date(r.createdAt).toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) || 0) + 1);
      const key = r.farmerId || r.farmId;
      if (key) byFarmer.set(key, (byFarmer.get(key) || 0) + 1);
    }
    const byDayArr = Array.from(byDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    const topEntries = Array.from(byFarmer.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    const topActive = [];
    for (const [id, events] of topEntries) {
      let name = null;
      try {
        if (prisma.farmer && typeof prisma.farmer.findUnique === 'function') {
          const f = await prisma.farmer.findUnique({ where: { id: String(id) }, select: { fullName: true } });
          name = f && f.fullName ? f.fullName : null;
        }
      } catch { /* leave null */ }
      topActive.push({ farmerId: String(id), name, events });
    }
    return { byDay: byDayArr, topActive };
  } catch { return empty; }
}

async function buildTasks({ prisma, since }) {
  const empty = { completed: 0, assigned: 0, rate: 0 };
  if (!prisma) return empty;
  try {
    let completed = 0;
    let assigned = 0;
    if (prisma.farmTaskCompletion) {
      completed = await prisma.farmTaskCompletion.count({
        where: { completedAt: { gte: new Date(since) } },
      });
    }
    if (prisma.farmTaskAssignment) {
      assigned = await prisma.farmTaskAssignment.count({
        where: { createdAt: { gte: new Date(since) } },
      });
    }
    const rate = assigned > 0 ? completed / assigned : (completed > 0 ? 1 : 0);
    return { completed: safeInt(completed), assigned: safeInt(assigned), rate: safePct(rate) };
  } catch { return empty; }
}

async function buildRisk({ prisma, since, now }) {
  const empty = {
    distribution: { low: 0, medium: 0, high: 0, critical: 0 },
    topRiskyFarms: [],
  };
  if (!prisma || !prisma.farmMetrics) return empty;
  try {
    const rows = await prisma.farmMetrics.findMany({
      where: { metric: 'risk_score', capturedAt: { gte: new Date(since) } },
      orderBy: { capturedAt: 'desc' },
    });
    const latest = new Map();
    for (const r of rows) {
      if (!latest.has(r.farmId)) latest.set(r.farmId, r);
    }
    const distribution = { low: 0, medium: 0, high: 0, critical: 0 };
    const ranked = [];
    for (const r of latest.values()) {
      const score = Number(r.value);
      if (!Number.isFinite(score)) continue;
      const level = score >= 60 ? 'critical'
                  : score >= 35 ? 'high'
                  : score >= 15 ? 'medium'
                  :                'low';
      distribution[level] += 1;
      ranked.push({ farmId: r.farmId, score, level,
        reasons: (r.metadata && r.metadata.factors) || [] });
    }
    ranked.sort((a, b) => b.score - a.score);
    const topRiskyFarms = ranked.slice(0, 10);

    if (prisma.farmer && typeof prisma.farmer.findMany === 'function') {
      try {
        const ids = topRiskyFarms.map((r) => r.farmId);
        const farmers = ids.length > 0
          ? await prisma.farmer.findMany({
              where: { id: { in: ids } },
              select: { id: true, fullName: true },
            })
          : [];
        const nameById = new Map(farmers.map((f) => [f.id, f.fullName]));
        for (const r of topRiskyFarms) {
          r.farmerName = nameById.get(r.farmId) || null;
        }
      } catch { /* names are optional */ }
    }
    return { distribution, topRiskyFarms };
  } catch { return empty; }
}

async function buildNeedsAttention({ prisma, since, now }) {
  if (!prisma) return [];
  try {
    if (prisma.issue && typeof prisma.issue.findMany === 'function') {
      const issues = await prisma.issue.findMany({
        where: {
          status: { in: ['open', 'assigned', 'escalated'] },
          severity: { in: ['high', 'critical'] },
        },
        orderBy: { createdAt: 'asc' },
        take: 20,
      });
      return issues.map((i) => ({
        farmId:      i.farmId || null,
        farmerName:  pickName(i),
        reason:      `${i.severity} ${i.issueType || 'issue'}`,
        priority:    i.severity === 'critical' ? 'critical' : 'high',
        daysSince:   Math.max(0, Math.floor((now - new Date(i.createdAt).getTime()) / DAY_MS)),
      }));
    }
  } catch { /* empty array fallback */ }
  return [];
}

async function buildActionsTaken({ prisma, since }) {
  if (!prisma || !prisma.actionLog || typeof prisma.actionLog.findMany !== 'function') {
    return [];
  }
  try {
    const rows = await prisma.actionLog.findMany({
      where: { createdAt: { gte: new Date(since) } },
      select: { actionType: true, outcome: true },
    });
    const byType = new Map();
    for (const r of rows) {
      const t = String(r.actionType || 'unknown');
      const bucket = byType.get(t) || { type: t, count: 0, success: 0 };
      bucket.count += 1;
      if (r.outcome === 'success') bucket.success += 1;
      byType.set(t, bucket);
    }
    return Array.from(byType.values())
      .map(({ type, count, success }) => ({
        type, count,
        successRate: count > 0 ? safePct(success / count) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  } catch { return []; }
}

// ─── Main entry ──────────────────────────────────────────────────

/**
 * buildWeeklyReport — compile every section in parallel so one
 * slow table never blocks the others. Returns a frozen report.
 */
export async function buildWeeklyReport({
  prisma     = null,
  program    = null,
  now        = Date.now(),
  windowDays = 7,
} = {}) {
  const since      = startOfWindow(now, windowDays);
  const priorSince = startOfWindow(since, windowDays);

  const [summary, activity, tasks, risk, needsAttention, actionsTaken] = await Promise.all([
    buildSummary({ prisma, program, since, priorSince, now }),
    buildActivity({ prisma, program, since, now }),
    buildTasks({ prisma, since }),
    buildRisk({ prisma, since, now }),
    buildNeedsAttention({ prisma, since, now }),
    buildActionsTaken({ prisma, since }),
  ]);

  return Object.freeze({
    meta: Object.freeze({
      program: program || null,
      generatedAt: new Date(now).toISOString(),
      windowStart: new Date(since).toISOString(),
      windowEnd:   new Date(now).toISOString(),
      windowDays,
    }),
    summary:        Object.freeze(summary),
    activity:       Object.freeze(activity),
    tasks:          Object.freeze(tasks),
    risk:           Object.freeze(risk),
    needsAttention: Object.freeze(needsAttention.map(Object.freeze)),
    actionsTaken:   Object.freeze(actionsTaken.map(Object.freeze)),
  });
}

// ─── Format helpers (consumable by email + HTTP routes) ─────────

/**
 * formatReportAsText — compact plain-text version suitable for
 * email bodies + SMS (shortened). Preserves the decision-first
 * structure: summary first, then needs-attention, then the rest.
 */
export function formatReportAsText(report) {
  if (!report) return '';
  const s = report.summary;
  const lines = [];
  const scope = report.meta.program || 'All programs';
  const start = report.meta.windowStart.slice(0, 10);
  const end   = report.meta.windowEnd.slice(0, 10);
  lines.push(`Farroway weekly report \u2014 ${scope}`);
  lines.push(`Window: ${start} \u2192 ${end} (${report.meta.windowDays} days)`);
  lines.push('');
  lines.push('Summary:');
  lines.push(`  Farmers total/active: ${s.totalFarmers} / ${s.activeFarmers}`);
  lines.push(`  Task completion: ${Math.round(s.taskCompletionRate * 100)}%`);
  lines.push(`  Open issues: ${s.openIssues} | Resolved: ${s.resolvedIssues}`);
  lines.push(`  High-risk farmers: ${s.highRiskFarmers}`);
  const d = s.changeVsPrior;
  lines.push(`  vs last week: active ${d.activeFarmers >= 0 ? '+' : ''}${d.activeFarmers}, issues ${d.openIssues >= 0 ? '+' : ''}${d.openIssues}, tasks ${d.tasksCompleted >= 0 ? '+' : ''}${d.tasksCompleted}`);
  if (report.needsAttention.length > 0) {
    lines.push('');
    lines.push('Needs attention:');
    for (const n of report.needsAttention.slice(0, 10)) {
      lines.push(`  - ${n.farmerName || n.farmId}: ${n.reason} (${n.daysSince}d, ${n.priority})`);
    }
  }
  if (report.risk.topRiskyFarms.length > 0) {
    lines.push('');
    lines.push('Top risk scores:');
    for (const r of report.risk.topRiskyFarms.slice(0, 5)) {
      lines.push(`  - ${r.farmerName || r.farmId}: ${Math.round(r.score)} (${r.level})`);
    }
  }
  if (report.actionsTaken.length > 0) {
    lines.push('');
    lines.push('Actions taken:');
    for (const a of report.actionsTaken.slice(0, 8)) {
      lines.push(`  - ${a.type}: ${a.count} (${Math.round(a.successRate * 100)}% success)`);
    }
  }
  return lines.join('\n');
}

/**
 * formatReportAsCsv — flat per-farmer export. One row per top
 * risk-ranked farm + fallback empty header when the risk table
 * is empty. Callers pipe this directly to res.send() with a
 * text/csv content type.
 */
export function formatReportAsCsv(report) {
  const headers = [
    'farmId', 'farmerName', 'score', 'level',
    'reason', 'priority', 'daysSince',
  ];
  const rows = [headers.join(',')];
  const push = (cells) => rows.push(cells.map(csvCell).join(','));
  const ranked = (report && report.risk && report.risk.topRiskyFarms) || [];
  for (const r of ranked) {
    push([r.farmId || '', r.farmerName || '', Math.round(r.score || 0), r.level || '', '', '', '']);
  }
  const attention = (report && report.needsAttention) || [];
  for (const a of attention) {
    push([a.farmId || '', a.farmerName || '', '', '', a.reason || '', a.priority || '', a.daysSince || 0]);
  }
  return rows.join('\n') + '\n';
}

function csvCell(v) {
  if (v == null) return '';
  const s = String(v);
  if (/["\n,]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * formatReportAsHtml — print-optimised HTML page. Browsers' "Save
 * as PDF" renders this cleanly, so we don't ship a heavy PDF
 * library with the server. Inline CSS because emails won't load
 * external stylesheets.
 */
export function formatReportAsHtml(report) {
  if (!report) return '<!doctype html><html><body><p>No report.</p></body></html>';
  const s = report.summary;
  const escape = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const scope = escape(report.meta.program || 'All programs');
  const win   = `${escape(report.meta.windowStart.slice(0,10))} \u2192 ${escape(report.meta.windowEnd.slice(0,10))}`;

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Farroway weekly report</title></head>
<body style="font-family:Arial,sans-serif;max-width:720px;margin:24px auto;color:#1B2330">
<h1 style="margin:0 0 4px">Weekly report</h1>
<div style="color:#6B7280;font-size:14px;margin-bottom:24px">${scope} \u00b7 ${win}</div>

<h2 style="font-size:16px">Summary</h2>
<table style="width:100%;border-collapse:collapse;margin-bottom:18px">
  <tr><td>Farmers (total / active)</td><td><strong>${s.totalFarmers} / ${s.activeFarmers}</strong></td></tr>
  <tr><td>Task completion rate</td><td><strong>${Math.round(s.taskCompletionRate * 100)}%</strong></td></tr>
  <tr><td>Open issues</td><td><strong>${s.openIssues}</strong></td></tr>
  <tr><td>Resolved this week</td><td><strong>${s.resolvedIssues}</strong></td></tr>
  <tr><td>High-risk farmers</td><td><strong>${s.highRiskFarmers}</strong></td></tr>
</table>

<h2 style="font-size:16px">Needs attention</h2>
${renderAttentionHtml(report.needsAttention, escape)}

<h2 style="font-size:16px">Top risk scores</h2>
${renderRiskHtml(report.risk.topRiskyFarms, escape)}

<h2 style="font-size:16px">Actions taken</h2>
${renderActionsHtml(report.actionsTaken, escape)}

<div style="color:#9CA3AF;font-size:12px;margin-top:32px">
  Generated ${escape(report.meta.generatedAt)} \u00b7 window ${report.meta.windowDays} days
</div>
</body></html>`;
}

function renderAttentionHtml(list, escape) {
  if (!list || list.length === 0) return '<p style="color:#86EFAC">Everything looks clear.</p>';
  const rows = list.slice(0, 10).map((n) =>
    `<tr><td>${escape(n.farmerName || n.farmId)}</td><td>${escape(n.reason)}</td>`
    + `<td><em>${escape(n.priority)}</em></td><td>${Number(n.daysSince) || 0} d</td></tr>`,
  ).join('');
  return `<table style="width:100%;border-collapse:collapse;margin-bottom:18px">${rows}</table>`;
}

function renderRiskHtml(list, escape) {
  if (!list || list.length === 0) return '<p>No risk data yet.</p>';
  const rows = list.slice(0, 5).map((r) =>
    `<tr><td>${escape(r.farmerName || r.farmId)}</td><td><strong>${Math.round(r.score)}</strong></td>`
    + `<td>${escape(r.level)}</td></tr>`,
  ).join('');
  return `<table style="width:100%;border-collapse:collapse;margin-bottom:18px">${rows}</table>`;
}

function renderActionsHtml(list, escape) {
  if (!list || list.length === 0) return '<p>No actions recorded.</p>';
  const rows = list.slice(0, 8).map((a) =>
    `<tr><td>${escape(a.type)}</td><td>${a.count}</td>`
    + `<td>${Math.round((a.successRate || 0) * 100)}%</td></tr>`,
  ).join('');
  return `<table style="width:100%;border-collapse:collapse;margin-bottom:18px">${rows}</table>`;
}

export const _internal = Object.freeze({
  startOfWindow, safeInt, safePct, csvCell,
  buildSummary, buildActivity, buildTasks, buildRisk,
  buildNeedsAttention, buildActionsTaken,
});
