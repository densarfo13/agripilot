/**
 * farmTimelineEngine.js — Continuous Farm Loop Engine, unified farm
 * event timeline.
 *
 *   import { buildFarmTimeline, EVENT_KIND }
 *     from 'src/core/journal/farmTimelineEngine.js';
 *
 *   const timeline = buildFarmTimeline({
 *     scanHistory, scanOutcomes, weatherEvents,
 *     completedTasks, harvestEvents, interventions,
 *     decisions,
 *     limit: 60,
 *   });
 *
 *   timeline = {
 *     events: [{
 *       id, kind, atMs, atIso,
 *       label:  { key, fallback, params },
 *       detail: { key, fallback, params } | null,
 *       severity: 'mild' | 'moderate' | 'serious' | null,
 *       source: string,
 *     }],
 *     bucketsByDay: [{ day, events }],
 *     engineVersion: 'farm-timeline-v1',
 *     generatedAt: number,
 *   }
 *
 * What this is
 * ────────────
 *   A read-only projection that merges every dated thing on a farm
 *   into one timeline: scans, scan outcomes, weather events,
 *   completed tasks, harvest milestones, NGO interventions,
 *   recommendation decisions. Each entry is normalized to a
 *   `{id, kind, atMs, label, detail}` envelope.
 *
 *   We never throw on a missing field — anything we can't make
 *   sense of is silently skipped. The output is capped (default 60)
 *   so the journal stays fast.
 *
 *   This composes existing memory stores; it does NOT replace
 *   `scanProgressionTimeline` (still the canonical scan-only
 *   timeline) nor write to any store.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Every visible string is a `{key, fallback, params}` envelope.
 *   • Deterministic ordering: newest first.
 */

const ENGINE_VERSION = 'farm-timeline-v1';

export const EVENT_KIND = Object.freeze({
  SCAN:           'scan',
  SCAN_OUTCOME:   'scan_outcome',
  WEATHER:        'weather',
  TASK_DONE:      'task_done',
  HARVEST:        'harvest',
  INTERVENTION:   'intervention',
  DECISION:       'decision',
  DISEASE_FOUND:  'disease_found',
  RECOVERY:       'recovery',
});

const _isObj  = (v) => v != null && typeof v === 'object';
const _str    = (v) => (typeof v === 'string' ? v : '');
const _num    = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe   = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _ymd(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function _normalizeScan(s, idx) {
  const atMs = _num(s.createdAt) || _num(s.timestamp) || _num(s.atMs);
  if (atMs == null) return null;
  const category = _str(s.diseasePrediction || s.cropPrediction || s.lifecycle || s.label);
  const severity = _str(s.severity).toLowerCase() || null;
  const sevValid = severity === 'mild' || severity === 'moderate' || severity === 'serious'
    ? severity : null;
  return Object.freeze({
    id:        s.id || s.scanId || ('scan_' + idx),
    kind:      EVENT_KIND.SCAN,
    atMs,
    atIso:     new Date(atMs).toISOString(),
    label: Object.freeze({
      key:      'timeline.scan.label',
      fallback: 'Scanned {label}',
      params:   { label: category || 'a plant' },
    }),
    detail: sevValid ? Object.freeze({
      key:      'timeline.scan.detail.' + sevValid,
      fallback: sevValid === 'serious'
        ? 'Marked as serious — needs attention.'
        : sevValid === 'moderate'
          ? 'Marked as moderate — worth checking again.'
          : 'Marked as mild — keep an eye on it.',
    }) : null,
    severity:  sevValid,
    source:    'scan',
  });
}

function _normalizeOutcome(o, idx) {
  const atMs = _num(o.recordedAt) || _num(o.atMs);
  if (atMs == null) return null;
  const out = _str(o.outcome).toLowerCase();
  const kind = (out === 'resolved' || out === 'improved')
    ? EVENT_KIND.RECOVERY : EVENT_KIND.SCAN_OUTCOME;
  return Object.freeze({
    id:        ('outcome_' + (o.scanId || idx)),
    kind,
    atMs,
    atIso:     new Date(atMs).toISOString(),
    label: Object.freeze({
      key:      'timeline.outcome.' + out,
      fallback: out === 'resolved'    ? 'Issue resolved'
              : out === 'improved'    ? 'Issue improved'
              : out === 'worsened'    ? 'Issue got worse'
              : out === 'escalated'   ? 'Issue escalated'
              : out === 'no_change'   ? 'No change yet'
              : out === 'wrong_diagnosis' ? 'Wrong diagnosis flagged'
              : 'Outcome recorded',
    }),
    detail: null,
    severity: out === 'worsened' || out === 'escalated' ? 'serious'
            : out === 'no_change'                       ? 'moderate'
            : null,
    source: 'outcome',
  });
}

function _normalizeWeatherEvent(e, idx) {
  const atMs = _num(e.atMs) || _num(e.timestamp);
  if (atMs == null) return null;
  const type = _str(e.type).toLowerCase();
  let label;
  let severity = null;
  if (type === 'frost')      { label = { key: 'timeline.weather.frost',  fallback: 'Frost event' }; severity = 'serious'; }
  else if (type === 'heat')  { label = { key: 'timeline.weather.heat',   fallback: 'Heat event'  }; severity = 'moderate'; }
  else if (type === 'rain')  { label = { key: 'timeline.weather.rain',   fallback: 'Heavy rain'  }; severity = 'mild';     }
  else if (type === 'wind')  { label = { key: 'timeline.weather.wind',   fallback: 'High wind'   }; severity = 'moderate'; }
  else if (type === 'drought'){ label = { key: 'timeline.weather.drought', fallback: 'Dry spell' }; severity = 'moderate'; }
  else { label = { key: 'timeline.weather.generic', fallback: 'Weather event' }; }
  return Object.freeze({
    id:     e.id || ('weather_' + idx),
    kind:   EVENT_KIND.WEATHER,
    atMs,
    atIso:  new Date(atMs).toISOString(),
    label:  Object.freeze(label),
    detail: e.detail ? Object.freeze({
      key:      _str(e.detail.key) || 'timeline.weather.detail',
      fallback: _str(e.detail.fallback) || '',
    }) : null,
    severity,
    source: 'weather',
  });
}

function _normalizeTask(t, idx) {
  const atMs = _num(t.completedAt) || _num(t.atMs);
  if (atMs == null) return null;
  return Object.freeze({
    id:     t.id || ('task_' + idx),
    kind:   EVENT_KIND.TASK_DONE,
    atMs,
    atIso:  new Date(atMs).toISOString(),
    label: Object.freeze({
      key:      'timeline.task.completed',
      fallback: '{label} completed',
      params:   { label: _str(t.label) || _str(t.title) || 'Task' },
    }),
    detail: null,
    severity: null,
    source: 'task',
  });
}

function _normalizeHarvest(h, idx) {
  const atMs = _num(h.atMs) || _num(h.harvestedAt) || _num(h.timestamp);
  if (atMs == null) return null;
  return Object.freeze({
    id:     h.id || ('harvest_' + idx),
    kind:   EVENT_KIND.HARVEST,
    atMs,
    atIso:  new Date(atMs).toISOString(),
    label: Object.freeze({
      key:      'timeline.harvest.label',
      fallback: 'Harvested {crop}',
      params:   { crop: _str(h.crop) || 'crop' },
    }),
    detail: h.quantity ? Object.freeze({
      key:      'timeline.harvest.detail.qty',
      fallback: 'About {qty}.',
      params:   { qty: _str(h.quantity) },
    }) : null,
    severity: null,
    source: 'harvest',
  });
}

function _normalizeIntervention(i, idx) {
  const atMs = _num(i.atMs) || _num(i.appliedAt);
  if (atMs == null) return null;
  return Object.freeze({
    id:     i.id || ('intervention_' + idx),
    kind:   EVENT_KIND.INTERVENTION,
    atMs,
    atIso:  new Date(atMs).toISOString(),
    label: Object.freeze({
      key:      'timeline.intervention.label',
      fallback: 'Applied {label}',
      params:   { label: _str(i.label) || _str(i.name) || 'treatment' },
    }),
    detail: null,
    severity: null,
    source: 'intervention',
  });
}

function _normalizeDecision(d, idx) {
  const atMs = _num(d.generatedAt) || _num(d.atMs);
  if (atMs == null) return null;
  return Object.freeze({
    id:     d.id || ('decision_' + idx),
    kind:   EVENT_KIND.DECISION,
    atMs,
    atIso:  new Date(atMs).toISOString(),
    label: Object.freeze({
      key:      _str(d.oneBestAction && d.oneBestAction.key) || 'timeline.decision.label',
      fallback: _str(d.oneBestAction && d.oneBestAction.fallback) || 'Recommendation surfaced',
      params:   d.oneBestAction && d.oneBestAction.params,
    }),
    detail: d.reason ? Object.freeze({
      key:      _str(d.reason.key),
      fallback: _str(d.reason.fallback),
      params:   d.reason.params,
    }) : null,
    severity: null,
    source:   'decision',
  });
}

/**
 * Merge dated sources into one timeline. All inputs are optional —
 * pass what you have.
 */
export function buildFarmTimeline(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};
    const limit = _num(safe.limit) || 60;

    const events = [];
    const _push = (e) => { if (e) events.push(e); };

    (safe.scanHistory || []).forEach((s, i) => { if (_isObj(s)) _push(_normalizeScan(s, i)); });
    (safe.scanOutcomes || []).forEach((o, i) => { if (_isObj(o)) _push(_normalizeOutcome(o, i)); });
    (safe.weatherEvents || []).forEach((w, i) => { if (_isObj(w)) _push(_normalizeWeatherEvent(w, i)); });
    (safe.completedTasks || []).forEach((t, i) => { if (_isObj(t)) _push(_normalizeTask(t, i)); });
    (safe.harvestEvents || []).forEach((h, i) => { if (_isObj(h)) _push(_normalizeHarvest(h, i)); });
    (safe.interventions || []).forEach((iv, i) => { if (_isObj(iv)) _push(_normalizeIntervention(iv, i)); });
    (safe.decisions || []).forEach((d, i) => { if (_isObj(d)) _push(_normalizeDecision(d, i)); });

    events.sort((a, b) => b.atMs - a.atMs);
    const capped = events.slice(0, limit);

    // Build per-day buckets for the journal "day group" view.
    const bucketMap = new Map();
    for (const e of capped) {
      const day = _ymd(e.atMs);
      if (!bucketMap.has(day)) bucketMap.set(day, []);
      bucketMap.get(day).push(e);
    }
    const bucketsByDay = Array.from(bucketMap.entries()).map(([day, evs]) =>
      Object.freeze({ day, events: Object.freeze(evs) }));

    return Object.freeze({
      engineVersion: ENGINE_VERSION,
      events:        Object.freeze(capped),
      bucketsByDay:  Object.freeze(bucketsByDay),
      generatedAt:   Date.now(),
    });
  }, _emptyTimeline());
}

function _emptyTimeline() {
  return Object.freeze({
    engineVersion: ENGINE_VERSION,
    events:        Object.freeze([]),
    bucketsByDay:  Object.freeze([]),
    generatedAt:   Date.now(),
  });
}

export const _internal = Object.freeze({
  _normalizeScan, _normalizeOutcome, _normalizeWeatherEvent,
  _normalizeTask, _normalizeHarvest, _normalizeIntervention,
  _normalizeDecision, _ymd, ENGINE_VERSION,
});

const _module = { buildFarmTimeline, EVENT_KIND, _internal };
export default _module;
