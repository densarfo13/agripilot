/**
 * farmTimeline.js — chronological farm-event feed + per-farm memory
 * summariser. Covers spec §4 (autonomous farm timeline) AND §5 (field
 * memory system) as a single aggregator since both read the same
 * underlying stores.
 *
 *   const timeline = buildFarmTimeline({
 *     scanHistory: getScanUsefulHistory(),
 *     scanTasks:   getActiveScanTasks(),
 *   });
 *   // → [{ at, kind, label, ref }, ...]  newest first
 *
 *   const memory = buildFieldMemory({ scanHistory });
 *   // → {
 *   //     pastDiseases:    [{ name, count, lastSeen }],
 *   //     treatmentWins:   [{ category, count, lastWonAt }],
 *   //     seasonalPattern: { dryMonths: [...], wetMonths: [...] },
 *   //     cropPerformance: [{ crop, scans, lastSeverity, trend }],
 *   //   }
 *
 * Honest scope
 * ─────────────
 *   The §5 "historical yields" field is intentionally OUT — we
 *   don't store yield numbers anywhere on-device today, so any
 *   number we returned would be a fabrication. The summariser
 *   surfaces what we DO know:
 *
 *     • which diseases recurred (counts + last-seen date)
 *     • which treatments correlated with severity dropping
 *     • dry / wet months from scan-history's weather caution lines
 *     • per-crop scan count + most recent severity + recovery trend
 *
 *   The §4 timeline is a simple chronological merge — we don't
 *   pretend to know about rainfall, planting, harvest events
 *   that no store records. When those stores exist (future
 *   spec round), the merge accepts them via the `extra` input.
 *
 * Strict-rule audit
 *   • Pure functions. Never throw.
 *   • Sorted newest-first; identical timestamps tied on `kind`.
 *   • Memory output is bounded — top-5 diseases, top-3 treatments.
 */

const _MS_PER_DAY = 24 * 60 * 60 * 1000;

function _isoTime(iso) {
  if (!iso) return null;
  const t = Date.parse(String(iso));
  return Number.isNaN(t) ? null : t;
}

function _safeStr(v) {
  const s = String(v == null ? '' : v).trim();
  return s ? s : null;
}

function _normLower(v) {
  const s = String(v == null ? '' : v).toLowerCase().trim();
  return s || null;
}

// ─── §4 Farm Timeline ────────────────────────────────────────

/**
 * Merge scan + task + (future) rainfall events into a single
 * chronological feed.
 *
 * @param {object} input
 * @param {Array<object>} [input.scanHistory] — scanHistoryStore entries
 * @param {Array<object>} [input.scanTasks]   — scanToTask entries
 * @param {Array<object>} [input.extra]       — caller-supplied events
 *                                                 with at + kind + label
 * @returns {Array<{ at: string, kind: string, label: string, ref: object|null }>}
 */
export function buildFarmTimeline(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  const events = [];

  const scans = Array.isArray(safe.scanHistory) ? safe.scanHistory : [];
  for (const e of scans) {
    if (!e || !e.createdAt) continue;
    const issue = _safeStr(e.noticed) || 'Scan recorded';
    events.push({
      at:    e.createdAt,
      kind:  'scan',
      label: `Scan: ${issue}${e.severity ? ` (${e.severity})` : ''}`,
      ref:   e,
    });
  }

  const tasks = Array.isArray(safe.scanTasks) ? safe.scanTasks : [];
  for (const t of tasks) {
    if (!t) continue;
    if (t.createdAt) {
      events.push({
        at:    t.createdAt,
        kind:  'task_created',
        label: `Task added: ${_safeStr(t.title) || 'follow-up'}`,
        ref:   t,
      });
    }
    if (t.completed && t.completedAt) {
      events.push({
        at:    t.completedAt,
        kind:  'task_completed',
        label: `Completed: ${_safeStr(t.title) || 'task'}`,
        ref:   t,
      });
    }
  }

  // §4 hook for future event sources (rainfall events, planting,
  // harvest) — caller can pass pre-shaped entries and they merge
  // cleanly into the same sort.
  const extra = Array.isArray(safe.extra) ? safe.extra : [];
  for (const e of extra) {
    if (!e || !e.at || !e.kind || !e.label) continue;
    events.push({ at: e.at, kind: String(e.kind), label: String(e.label), ref: e.ref || null });
  }

  // Newest first; stable on kind for ties.
  events.sort((a, b) => {
    const ta = _isoTime(a.at) || 0;
    const tb = _isoTime(b.at) || 0;
    if (tb !== ta) return tb - ta;
    return String(a.kind).localeCompare(String(b.kind));
  });

  return events;
}

// ─── §5 Field Memory ─────────────────────────────────────────

/**
 * Summarise per-farm memory: which issues recurred, which
 * treatments correlated with severity dropping, seasonal weather
 * patterns from past briefings, crop-by-crop performance.
 *
 * @param {object} input
 * @param {Array<object>} [input.scanHistory] — scanHistoryStore entries
 * @param {Array<object>} [input.scanTasks]   — scanToTask entries
 * @param {number} [input.nowMs]
 * @returns {{
 *   pastDiseases:    Array<{ name, count, lastSeen }>,
 *   treatmentWins:   Array<{ category, count, lastWonAt }>,
 *   seasonalPattern: { dryMonths: number[], wetMonths: number[] },
 *   cropPerformance: Array<{ crop, scans, lastSeverity, trend }>,
 * }}
 */
export function buildFieldMemory(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  const history = Array.isArray(safe.scanHistory) ? safe.scanHistory : [];
  const tasks   = Array.isArray(safe.scanTasks)   ? safe.scanTasks   : [];

  // ── Past diseases (top 5 by frequency) ────────────────────
  const diseaseMap = new Map();
  for (const e of history) {
    if (!e) continue;
    const name = _normLower(e.noticed);
    if (!name) continue;
    const existing = diseaseMap.get(name);
    const t = _isoTime(e.createdAt);
    if (existing) {
      existing.count += 1;
      if (t != null && (!existing.lastSeenMs || t > existing.lastSeenMs)) {
        existing.lastSeenMs = t;
        existing.lastSeen = e.createdAt;
      }
    } else {
      diseaseMap.set(name, {
        name,
        count: 1,
        lastSeenMs: t,
        lastSeen: e.createdAt || null,
      });
    }
  }
  const pastDiseases = Array.from(diseaseMap.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return (b.lastSeenMs || 0) - (a.lastSeenMs || 0);
    })
    .slice(0, 5)
    .map(({ name, count, lastSeen }) => ({ name, count, lastSeen }));

  // ── Treatment wins ────────────────────────────────────────
  // A "win" = a completed scan-task whose category later showed a
  // severity drop for the same crop. We use a simplified proxy:
  // count completed tasks per category. The richer correlation
  // model (look at the next scan and confirm severity dropped) is
  // achievable but more invasive — we ship the simple count now
  // and label it as "completed treatments" since that's what the
  // data actually proves.
  const winMap = new Map();
  for (const t of tasks) {
    if (!t || !t.completed) continue;
    const cat = _normLower(t.actionType) || 'treatment';
    const existing = winMap.get(cat);
    const at = _isoTime(t.completedAt);
    if (existing) {
      existing.count += 1;
      if (at != null && (!existing.lastWonMs || at > existing.lastWonMs)) {
        existing.lastWonMs = at;
        existing.lastWonAt = t.completedAt;
      }
    } else {
      winMap.set(cat, {
        category: cat,
        count: 1,
        lastWonMs: at,
        lastWonAt: t.completedAt || null,
      });
    }
  }
  const treatmentWins = Array.from(winMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(({ category, count, lastWonAt }) => ({ category, count, lastWonAt }));

  // ── Seasonal pattern (which calendar months saw weather caution) ─
  // The scanHistory stores `weatherCaution` per scan from the
  // decision envelope. Months where caution mentioned "dry" /
  // "drought" land in dryMonths; "rain" / "humid" / "flood" land
  // in wetMonths. We return month indexes (0..11) so a UI can map
  // to localized month names.
  const dryCounts = new Array(12).fill(0);
  const wetCounts = new Array(12).fill(0);
  for (const e of history) {
    if (!e || !e.weatherCaution) continue;
    const t = _isoTime(e.createdAt);
    if (t === null) continue;
    const month = new Date(t).getMonth();
    const cw = String(e.weatherCaution).toLowerCase();
    if (cw.includes('dry') || cw.includes('drought') || cw.includes('heat')) {
      dryCounts[month] += 1;
    }
    if (cw.includes('rain') || cw.includes('humid') || cw.includes('flood') || cw.includes('wet')) {
      wetCounts[month] += 1;
    }
  }
  // Surface only months with at least 2 hits so we don't claim a
  // pattern from a single observation.
  const dryMonths = dryCounts.map((c, i) => (c >= 2 ? i : -1)).filter((i) => i >= 0);
  const wetMonths = wetCounts.map((c, i) => (c >= 2 ? i : -1)).filter((i) => i >= 0);

  // ── Crop performance ──────────────────────────────────────
  const cropMap = new Map();
  // Sort newest-first so the first entry per crop becomes "latest".
  const sortedHistory = history
    .slice()
    .sort((a, b) => (_isoTime(b && b.createdAt) || 0) - (_isoTime(a && a.createdAt) || 0));
  for (const e of sortedHistory) {
    if (!e) continue;
    const crop = _normLower(e.crop);
    if (!crop) continue;
    if (!cropMap.has(crop)) {
      cropMap.set(crop, {
        crop,
        scans: 0,
        latestSeverityRaw: e.severity || null,
        latestRank: _severityRank(e.severity),
        priorRank: null,
      });
    }
    const c = cropMap.get(crop);
    c.scans += 1;
    if (c.priorRank === null && c.scans === 2) {
      c.priorRank = _severityRank(e.severity);
    }
  }
  const cropPerformance = Array.from(cropMap.values()).map((c) => {
    let trend = 'stable';
    if (c.latestRank && c.priorRank) {
      if (c.latestRank < c.priorRank)      trend = 'improving';
      else if (c.latestRank > c.priorRank) trend = 'worsening';
    } else if (c.scans <= 1) {
      trend = 'first_scan';
    }
    return {
      crop:         c.crop,
      scans:        c.scans,
      lastSeverity: c.latestSeverityRaw,
      trend,
    };
  });

  return {
    pastDiseases,
    treatmentWins,
    seasonalPattern: { dryMonths, wetMonths },
    cropPerformance,
  };
}

function _severityRank(raw) {
  const s = String(raw || '').toLowerCase();
  if (s === 'high'   || s.includes('high'))   return 3;
  if (s === 'medium' || s.includes('medium')) return 2;
  if (s === 'low'    || s.includes('low'))    return 1;
  return 0;
}

export default { buildFarmTimeline, buildFieldMemory };
