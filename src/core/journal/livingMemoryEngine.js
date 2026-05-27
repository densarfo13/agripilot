/**
 * livingMemoryEngine.js — Living Farm Continuity §6.
 *
 *   import { buildLivingMemory, MILESTONE }
 *     from 'src/core/journal/livingMemoryEngine.js';
 *
 *   const v = buildLivingMemory({
 *     scanHistory, scanOutcomes,
 *     wateringHistory, harvestEvents, completedTasks,
 *   });
 *
 *   v = {
 *     milestones: [{
 *       kind, atMs, title, detail,
 *       beforeScanId?, afterScanId?,
 *     }],
 *     totalScans, healthyStreak, recoveryCount,
 *     engineVersion: 'living-memory-v1', generatedAt,
 *   }
 *
 * What this is
 * ────────────
 *   Detects emotionally meaningful moments in the farm's history
 *   and packages them as TIMELINE-READY milestone envelopes. The
 *   Journal surface renders these as memory cards — "Your first
 *   scan", "Three healthy scans in a row", "First flower opened",
 *   "Recovery from leaf spot".
 *
 *   Not analytics; not a dashboard. Each milestone is a single
 *   memory moment with a calm title + short detail line + (where
 *   applicable) before/after scan IDs the surface can use for
 *   side-by-side photo comparison.
 *
 *   Composes — never replaces — `scanProgressionTimeline`,
 *   `farmTimelineEngine`, and `scanOutcomeTracker`.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Every visible string is `{key, fallback, params}`.
 *   • No analytics overload — caps at 10 milestones returned.
 */

const ENGINE_VERSION = 'living-memory-v1';
const MAX_MILESTONES = 10;

export const MILESTONE = Object.freeze({
  FIRST_SCAN:          'first_scan',
  HEALTHY_STREAK:      'healthy_streak',
  FIRST_ISSUE:         'first_issue',
  RECOVERY:            'recovery',
  FIRST_WATERING:      'first_watering',
  FIRST_FLOWER:        'first_flower',
  GROWTH_PROGRESSION:  'growth_progression',
  HARVEST:             'harvest',
  TREATMENT_SUCCESS:   'treatment_success',
});

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

// ─── Detectors ───────────────────────────────────────────────

function _firstScanMilestone(scanHistory) {
  const list = Array.isArray(scanHistory) ? scanHistory : [];
  if (list.length === 0) return null;
  // scanHistory is newest-first by convention; oldest is at the end.
  const oldest = list[list.length - 1];
  const atMs = _num(oldest && oldest.createdAt);
  if (atMs == null) return null;
  return Object.freeze({
    kind:    MILESTONE.FIRST_SCAN,
    atMs,
    title: Object.freeze({
      key:      'living.milestone.firstScan.title',
      fallback: 'Your first scan',
    }),
    detail: Object.freeze({
      key:      'living.milestone.firstScan.detail',
      fallback: 'This is where your farm journey on Farroway began.',
    }),
    scanId:  _str(oldest.id || oldest.scanId) || null,
  });
}

function _healthyStreakMilestone(scanHistory) {
  const list = Array.isArray(scanHistory) ? scanHistory.slice(0, 6) : [];
  if (list.length < 3) return null;
  const healthyish = list.every((s) => {
    const sev = _str(s && s.severity).toLowerCase();
    return sev === 'mild' || sev === '' || sev === 'healthy';
  });
  if (!healthyish) return null;
  const recent = list[0];
  const atMs = _num(recent && recent.createdAt);
  if (atMs == null) return null;
  return Object.freeze({
    kind:    MILESTONE.HEALTHY_STREAK,
    atMs,
    title: Object.freeze({
      key:      'living.milestone.healthyStreak.title',
      fallback: '{count} healthy scans in a row',
      params:   { count: list.length },
    }),
    detail: Object.freeze({
      key:      'living.milestone.healthyStreak.detail',
      fallback: 'Your routine is paying off — keep it going.',
    }),
  });
}

function _firstIssueMilestone(scanHistory) {
  const list = Array.isArray(scanHistory) ? scanHistory : [];
  // Find the OLDEST scan that flagged a non-mild issue.
  let oldestIssue = null;
  for (let i = list.length - 1; i >= 0; i--) {
    const s = list[i];
    const sev = _str(s && s.severity).toLowerCase();
    if (sev === 'moderate' || sev === 'serious') { oldestIssue = s; break; }
  }
  if (!oldestIssue) return null;
  const atMs = _num(oldestIssue.createdAt);
  if (atMs == null) return null;
  return Object.freeze({
    kind:    MILESTONE.FIRST_ISSUE,
    atMs,
    title: Object.freeze({
      key:      'living.milestone.firstIssue.title',
      fallback: 'First issue detected',
    }),
    detail: Object.freeze({
      key:      'living.milestone.firstIssue.detail',
      fallback: 'You caught this one early — the journey of learning your farm begins.',
    }),
    scanId: _str(oldestIssue.id || oldestIssue.scanId) || null,
  });
}

function _recoveryMilestones(scanOutcomes, scanHistory) {
  const outcomes = Array.isArray(scanOutcomes) ? scanOutcomes : [];
  const history = Array.isArray(scanHistory) ? scanHistory : [];
  const out = [];
  for (const o of outcomes) {
    if (!o) continue;
    const outcomeKind = _str(o.outcome).toLowerCase();
    if (outcomeKind !== 'resolved' && outcomeKind !== 'improved') continue;
    const atMs = _num(o.recordedAt);
    if (atMs == null) continue;
    // Try to find the "before" scan referenced by this outcome.
    const beforeScan = history.find((s) =>
      s && (s.id === o.scanId || s.scanId === o.scanId));
    out.push(Object.freeze({
      kind:    outcomeKind === 'resolved' ? MILESTONE.RECOVERY : MILESTONE.TREATMENT_SUCCESS,
      atMs,
      title: Object.freeze({
        key:      'living.milestone.' + (outcomeKind === 'resolved' ? 'recovery' : 'treatmentSuccess') + '.title',
        fallback: outcomeKind === 'resolved' ? 'Recovery moment' : 'Treatment worked',
      }),
      detail: Object.freeze({
        key:      'living.milestone.' + (outcomeKind === 'resolved' ? 'recovery' : 'treatmentSuccess') + '.detail',
        fallback: outcomeKind === 'resolved'
          ? 'Your plants made it through — a moment worth remembering.'
          : 'Your care worked — a good sign for the next time this comes up.',
      }),
      beforeScanId: beforeScan ? _str(beforeScan.id || beforeScan.scanId) : null,
    }));
  }
  return out;
}

function _firstWateringMilestone(wateringHistory) {
  const list = Array.isArray(wateringHistory) ? wateringHistory : [];
  if (list.length === 0) return null;
  const first = list[list.length - 1];
  const atMs = _num(first && first.at);
  if (atMs == null) return null;
  return Object.freeze({
    kind:    MILESTONE.FIRST_WATERING,
    atMs,
    title: Object.freeze({
      key:      'living.milestone.firstWatering.title',
      fallback: 'First watering logged',
    }),
    detail: Object.freeze({
      key:      'living.milestone.firstWatering.detail',
      fallback: 'You logged your first care moment — small habits compound over time.',
    }),
  });
}

function _firstFlowerMilestone(scanHistory) {
  const list = Array.isArray(scanHistory) ? scanHistory : [];
  // Look for the OLDEST scan whose stage signal includes flowering.
  let oldest = null;
  for (let i = list.length - 1; i >= 0; i--) {
    const s = list[i];
    const stage = _str(s && (s.lifecycleStage || s.stage)).toLowerCase();
    if (stage === 'flowering' || stage === 'flower') { oldest = s; break; }
  }
  if (!oldest) return null;
  const atMs = _num(oldest.createdAt);
  if (atMs == null) return null;
  return Object.freeze({
    kind:    MILESTONE.FIRST_FLOWER,
    atMs,
    title: Object.freeze({
      key:      'living.milestone.firstFlower.title',
      fallback: 'First flower opened',
    }),
    detail: Object.freeze({
      key:      'living.milestone.firstFlower.detail',
      fallback: 'A turning point in the season — fruit is on its way.',
    }),
  });
}

function _harvestMilestones(harvestEvents) {
  const list = Array.isArray(harvestEvents) ? harvestEvents : [];
  return list.map((h) => {
    const atMs = _num(h && (h.atMs || h.harvestedAt || h.timestamp));
    if (atMs == null) return null;
    return Object.freeze({
      kind:    MILESTONE.HARVEST,
      atMs,
      title: Object.freeze({
        key:      'living.milestone.harvest.title',
        fallback: 'Harvest day',
      }),
      detail: Object.freeze({
        key:      'living.milestone.harvest.detail',
        fallback: 'A season\'s care made tangible. {crop} ready for the table or market.',
        params:   { crop: _str(h.crop) || 'Your crop' },
      }),
    });
  }).filter(Boolean);
}

function _growthProgressionMilestone(scanHistory) {
  const list = Array.isArray(scanHistory) ? scanHistory : [];
  // Look for evidence of two distinct stages — indicates progression.
  const stages = new Set();
  for (const s of list.slice(0, 10)) {
    const stage = _str(s && (s.lifecycleStage || s.stage)).toLowerCase();
    if (stage) stages.add(stage);
  }
  if (stages.size < 2) return null;
  const newest = list[0];
  const atMs = _num(newest && newest.createdAt);
  if (atMs == null) return null;
  return Object.freeze({
    kind:    MILESTONE.GROWTH_PROGRESSION,
    atMs,
    title: Object.freeze({
      key:      'living.milestone.growthProgression.title',
      fallback: 'Growth stage advanced',
    }),
    detail: Object.freeze({
      key:      'living.milestone.growthProgression.detail',
      fallback: 'Your plants are moving through stages naturally.',
    }),
  });
}

// ─── Public ──────────────────────────────────────────────────

/**
 * Build the milestone envelope. Always returns an envelope.
 */
export function buildLivingMemory(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};
    const scanHistory     = safe.scanHistory;
    const scanOutcomes    = safe.scanOutcomes;
    const wateringHistory = safe.wateringHistory;
    const harvestEvents   = safe.harvestEvents;

    const milestones = [];
    const _push = (m) => { if (m) milestones.push(m); };

    _push(_firstScanMilestone(scanHistory));
    _push(_healthyStreakMilestone(scanHistory));
    _push(_firstIssueMilestone(scanHistory));
    for (const m of _recoveryMilestones(scanOutcomes, scanHistory)) _push(m);
    _push(_firstWateringMilestone(wateringHistory));
    _push(_firstFlowerMilestone(scanHistory));
    for (const m of _harvestMilestones(harvestEvents)) _push(m);
    _push(_growthProgressionMilestone(scanHistory));

    // Sort newest-first; cap at MAX_MILESTONES.
    milestones.sort((a, b) => b.atMs - a.atMs);
    const capped = milestones.slice(0, MAX_MILESTONES);

    // Quick rollups (no raw numbers shown — surface decides how to render).
    const totalScans = Array.isArray(scanHistory) ? scanHistory.length : 0;
    const recoveryCount = capped.filter((m) =>
      m.kind === MILESTONE.RECOVERY || m.kind === MILESTONE.TREATMENT_SUCCESS).length;
    const healthyStreak = (() => {
      const recent = Array.isArray(scanHistory) ? scanHistory.slice(0, 6) : [];
      let streak = 0;
      for (const s of recent) {
        const sev = _str(s && s.severity).toLowerCase();
        if (sev === 'mild' || sev === '' || sev === 'healthy') streak++;
        else break;
      }
      return streak;
    })();

    return Object.freeze({
      engineVersion: ENGINE_VERSION,
      milestones:    Object.freeze(capped),
      totalScans,
      healthyStreak,
      recoveryCount,
      generatedAt:   Date.now(),
    });
  }, _emptyEnvelope());
}

function _emptyEnvelope() {
  return Object.freeze({
    engineVersion: ENGINE_VERSION,
    milestones:    Object.freeze([]),
    totalScans:    0,
    healthyStreak: 0,
    recoveryCount: 0,
    generatedAt:   Date.now(),
  });
}

export const _internal = Object.freeze({
  _firstScanMilestone, _healthyStreakMilestone, _firstIssueMilestone,
  _recoveryMilestones, _firstWateringMilestone, _firstFlowerMilestone,
  _harvestMilestones, _growthProgressionMilestone,
  ENGINE_VERSION, MAX_MILESTONES,
});

const _module = { buildLivingMemory, MILESTONE, _internal };
export default _module;
