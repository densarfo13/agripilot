/**
 * src/runtime/plants/PlantTimeline.ts — unified plant timeline.
 *
 *   import {
 *     buildPlantTimeline, TIMELINE_EVENT_KIND,
 *     PLANT_TIMELINE_VERSION,
 *   } from 'src/runtime/plants/PlantTimeline';
 *
 *   buildPlantTimeline({ plant, events })
 *
 * What this is
 * ────────────
 *   The UI-friendly timeline view over what PlantMemoryGraph
 *   materializes raw. Newest first, grouped by ISO date,
 *   normalized into 11 spec'd event kinds with photo/scan/task/
 *   treatment attachments where available.
 *
 *   11 spec'd kinds:
 *     PlantCreated         — registered_from_scan / created_manually
 *     ScanCompleted        — SCAN_COMPLETED
 *     DiseaseDetected      — SCAN_COMPLETED with metadata.disease
 *                            OR SCAN_NEEDS_REVIEW with disease hint
 *     PestDetected         — scan event with metadata.pestHint
 *     TaskCompleted        — TASK_COMPLETED
 *     TreatmentApplied     — TREATMENT_APPLIED
 *     GrowthStageChanged   — stage_advanced history entry
 *     BloomStarted         — stage_advanced → 'flowering'
 *     HarvestCompleted     — stage_advanced → 'harvest' OR
 *                            HARVEST_LOGGED event
 *     RecommendationAccepted — RECOMMENDATION_ACCEPTED
 *     RecommendationCompleted — RECOMMENDATION_COMPLETED
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only over wave-5 event log + plant.history.
 *   • Does NOT modify eventEngine — 11 spec'd kinds are DERIVED
 *     from existing EVENT_KIND values, not added to the enum.
 *   • No fetch, no persistence writes.
 *   • Frozen envelopes throughout.
 */

import { EVENT_KIND } from '../flywheel/eventEngine.js';
import type { ManagedPlant } from './PlantRuntime';

export const PLANT_TIMELINE_VERSION = 'plant-timeline-v1';

export const TIMELINE_EVENT_KIND = Object.freeze({
  PlantCreated:           'PlantCreated',
  ScanCompleted:          'ScanCompleted',
  DiseaseDetected:        'DiseaseDetected',
  PestDetected:           'PestDetected',
  TaskGenerated:          'TaskGenerated',
  TaskCompleted:          'TaskCompleted',
  TreatmentApplied:       'TreatmentApplied',
  GrowthStageChanged:     'GrowthStageChanged',
  BloomStarted:           'BloomStarted',
  HarvestCompleted:       'HarvestCompleted',
  RecommendationAccepted: 'RecommendationAccepted',
  RecommendationCompleted: 'RecommendationCompleted',
  // Wave 10 — Launch Readiness spec additions.
  ReadyToSellMarked:      'ReadyToSellMarked',
  BuyerInterestReceived:  'BuyerInterestReceived',
  InterventionCompleted:  'InterventionCompleted',
});

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num   = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _isoDay(ts: string): string {
  return _safe(() => {
    const t = new Date(ts);
    if (Number.isNaN(t.getTime())) return '';
    const y = t.getUTCFullYear();
    const m = String(t.getUTCMonth() + 1).padStart(2, '0');
    const d = String(t.getUTCDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }, '');
}

function _msFromIso(ts: string): number {
  const t = _safe(() => new Date(ts).getTime(), NaN);
  return Number.isFinite(t) ? t : 0;
}

function _attachmentsFromScan(metadata: any) {
  if (!_isObj(metadata)) return Object.freeze({});
  // Photos / scans — surface whatever the scan envelope carries
  // WITHOUT inventing data. Scans go through the anonymizer
  // before they hit the event log so image URLs may already
  // be redacted; the timeline simply forwards what's present.
  const photos: any[] = [];
  if (_str(metadata.thumbnail))  photos.push({ kind: 'thumbnail', url: metadata.thumbnail });
  if (_str(metadata.imageUrl))   photos.push({ kind: 'image',     url: metadata.imageUrl });
  return Object.freeze({
    photos: Object.freeze(photos),
    scans:  Object.freeze([
      Object.freeze({
        scanId:     _str(metadata.scanId),
        confidence: _num(metadata.confidence),
        diagnosis:  _str(metadata.diagnosis)
                    || _str(metadata.possibleIssue),
      }),
    ]),
  });
}

function _attachmentsFromTask(metadata: any) {
  if (!_isObj(metadata)) return Object.freeze({});
  return Object.freeze({
    tasks: Object.freeze([
      Object.freeze({
        taskId: _str(metadata.taskId),
        title:  _str(metadata.title) || _str(metadata.label),
      }),
    ]),
  });
}

function _attachmentsFromTreatment(metadata: any) {
  if (!_isObj(metadata)) return Object.freeze({});
  return Object.freeze({
    treatments: Object.freeze([
      Object.freeze({
        treatmentId:   _str(metadata.treatmentId),
        treatmentKind: _str(metadata.treatmentKind),
      }),
    ]),
  });
}

function _entryFromEvent(e: any) {
  const eventType = _str(e.eventType);
  const ts        = _str(e.timestamp);
  const md        = _isObj(e.metadata) ? e.metadata : {};

  // SCAN_COMPLETED / SCAN_NEEDS_REVIEW → ScanCompleted base.
  // If metadata.disease or metadata.pestHint is set, additionally
  // emit a Disease/PestDetected derived entry — but the base
  // ScanCompleted is always emitted so the timeline doesn't lose
  // the scan record itself.
  const out: any[] = [];
  if (eventType === EVENT_KIND.SCAN_COMPLETED
   || eventType === EVENT_KIND.SCAN_NEEDS_REVIEW) {
    out.push(Object.freeze({
      id:          'tl_' + _str(e.eventId),
      kind:        TIMELINE_EVENT_KIND.ScanCompleted,
      at:          ts,
      day:         _isoDay(ts),
      summary:     eventType === EVENT_KIND.SCAN_NEEDS_REVIEW
                    ? 'Scan flagged for review'
                    : 'Scan completed',
      plantId:     _str(md.plantId),
      attachments: _attachmentsFromScan(md),
      sourceEventType: eventType,
    }));
    const disease = _str(md.disease) || _str(md.diagnosis)
                  || _str(md.possibleIssue);
    if (disease) {
      out.push(Object.freeze({
        id:          'tl_' + _str(e.eventId) + ':disease',
        kind:        TIMELINE_EVENT_KIND.DiseaseDetected,
        at:          ts,
        day:         _isoDay(ts),
        summary:     disease,
        plantId:     _str(md.plantId),
        attachments: _attachmentsFromScan(md),
        sourceEventType: eventType,
      }));
    }
    const pestHint = _str(md.pestHint);
    if (pestHint) {
      out.push(Object.freeze({
        id:          'tl_' + _str(e.eventId) + ':pest',
        kind:        TIMELINE_EVENT_KIND.PestDetected,
        at:          ts,
        day:         _isoDay(ts),
        summary:     pestHint,
        plantId:     _str(md.plantId),
        attachments: _attachmentsFromScan(md),
        sourceEventType: eventType,
      }));
    }
    return out;
  }
  if (eventType === EVENT_KIND.TASK_COMPLETED) {
    out.push(Object.freeze({
      id:          'tl_' + _str(e.eventId),
      kind:        TIMELINE_EVENT_KIND.TaskCompleted,
      at:          ts,
      day:         _isoDay(ts),
      summary:     _str(md.title) || _str(md.label) || 'Task completed',
      plantId:     _str(md.plantId),
      attachments: _attachmentsFromTask(md),
      sourceEventType: eventType,
    }));
    return out;
  }
  if (eventType === EVENT_KIND.TREATMENT_APPLIED) {
    out.push(Object.freeze({
      id:          'tl_' + _str(e.eventId),
      kind:        TIMELINE_EVENT_KIND.TreatmentApplied,
      at:          ts,
      day:         _isoDay(ts),
      summary:     _str(md.treatmentKind) || 'Treatment applied',
      plantId:     _str(md.plantId),
      attachments: _attachmentsFromTreatment(md),
      sourceEventType: eventType,
    }));
    return out;
  }
  if (eventType === EVENT_KIND.RECOMMENDATION_ACCEPTED) {
    out.push(Object.freeze({
      id:      'tl_' + _str(e.eventId),
      kind:    TIMELINE_EVENT_KIND.RecommendationAccepted,
      at:      ts,
      day:     _isoDay(ts),
      summary: _str(md.recommendationId) || 'Recommendation accepted',
      plantId: _str(md.plantId),
      attachments: Object.freeze({}),
      sourceEventType: eventType,
    }));
    return out;
  }
  if (eventType === EVENT_KIND.RECOMMENDATION_COMPLETED) {
    out.push(Object.freeze({
      id:      'tl_' + _str(e.eventId),
      kind:    TIMELINE_EVENT_KIND.RecommendationCompleted,
      at:      ts,
      day:     _isoDay(ts),
      summary: _str(md.recommendationId) || 'Recommendation completed',
      plantId: _str(md.plantId),
      attachments: Object.freeze({}),
      sourceEventType: eventType,
    }));
    return out;
  }
  if (eventType === EVENT_KIND.HARVEST_LOGGED) {
    out.push(Object.freeze({
      id:      'tl_' + _str(e.eventId),
      kind:    TIMELINE_EVENT_KIND.HarvestCompleted,
      at:      ts,
      day:     _isoDay(ts),
      summary: 'Harvest logged',
      plantId: _str(md.plantId),
      attachments: Object.freeze({}),
      sourceEventType: eventType,
    }));
    return out;
  }
  // Unknown event kind — skip, timeline only carries known kinds.
  return out;
}

function _entryFromHistory(h: any, plantId: string) {
  const ts = _str(h.at);
  if (h.kind === 'created_manually' || h.kind === 'registered_from_scan') {
    return Object.freeze({
      id:      'tlh_' + ts + ':created',
      kind:    TIMELINE_EVENT_KIND.PlantCreated,
      at:      ts,
      day:     _isoDay(ts),
      summary: h.kind === 'created_manually'
               ? 'Plant added manually'
               : 'Plant added from scan',
      plantId,
      attachments: Object.freeze(_str(h.scanId) ? {
        scans: Object.freeze([Object.freeze({ scanId: _str(h.scanId) })]),
      } : {}),
      sourceEventType: 'plant.history.' + h.kind,
    });
  }
  if (h.kind === 'stage_advanced') {
    const to = _str(h.to);
    const entries: any[] = [];
    entries.push(Object.freeze({
      id:      'tlh_' + ts + ':stage:' + to,
      kind:    TIMELINE_EVENT_KIND.GrowthStageChanged,
      at:      ts,
      day:     _isoDay(ts),
      summary: _str(h.from) + ' → ' + to,
      plantId,
      attachments: Object.freeze({}),
      sourceEventType: 'plant.history.stage_advanced',
    }));
    if (to === 'flowering') {
      entries.push(Object.freeze({
        id:      'tlh_' + ts + ':bloom',
        kind:    TIMELINE_EVENT_KIND.BloomStarted,
        at:      ts,
        day:     _isoDay(ts),
        summary: 'Bloom started',
        plantId,
        attachments: Object.freeze({}),
        sourceEventType: 'plant.history.stage_advanced',
      }));
    }
    if (to === 'harvest') {
      entries.push(Object.freeze({
        id:      'tlh_' + ts + ':harvest',
        kind:    TIMELINE_EVENT_KIND.HarvestCompleted,
        at:      ts,
        day:     _isoDay(ts),
        summary: 'Harvest stage reached',
        plantId,
        attachments: Object.freeze({}),
        sourceEventType: 'plant.history.stage_advanced',
      }));
    }
    return entries;
  }
  return [];
}

interface TimelineCtx {
  plant?:  ManagedPlant;
  events?: any[];
  limit?:  number;
}

export function buildPlantTimeline(ctx: TimelineCtx) {
  return _safe(() => {
    const c       = _isObj(ctx) ? ctx : {} as TimelineCtx;
    const plant   = _isObj(c.plant) ? c.plant : null;
    const plantId = plant ? plant.id : '';
    const events  = _arr(c.events);

    const entries: any[] = [];

    // Event log entries — filter to this plant
    for (const e of events) {
      if (!_isObj(e)) continue;
      const md = _isObj(e.metadata) ? e.metadata : null;
      if (!md) continue;
      if (_str(md.plantId) !== plantId) continue;
      const mapped = _entryFromEvent(e);
      for (const m of mapped) entries.push(m);
    }

    // Plant history entries
    if (plant && Array.isArray((plant as any).history)) {
      for (const h of (plant as any).history) {
        if (!_isObj(h)) continue;
        const mapped = _entryFromHistory(h, plantId);
        for (const m of mapped) entries.push(m);
      }
    }

    // Sort newest first
    entries.sort((a, b) => _msFromIso(b.at) - _msFromIso(a.at));

    // Cap to limit (default 200 for sane render bounds)
    const limit = _num(c.limit) ?? 200;
    const capped = entries.slice(0, limit);

    // Group by ISO day; groups also newest-first.
    const groupsMap = new Map<string, any[]>();
    for (const e of capped) {
      const day = _str(e.day);
      if (!day) continue;
      if (!groupsMap.has(day)) groupsMap.set(day, []);
      groupsMap.get(day)!.push(e);
    }
    const groups = Array.from(groupsMap.keys())
      .sort((a, b) => b.localeCompare(a))
      .map((day) => Object.freeze({
        date: day,
        entries: Object.freeze(groupsMap.get(day)!),
      }));

    // Counts per kind
    const counts: Record<string, number> = {};
    for (const k of Object.values(TIMELINE_EVENT_KIND)) counts[k] = 0;
    for (const e of capped) {
      counts[e.kind] = (counts[e.kind] || 0) + 1;
    }

    return Object.freeze({
      runtimeVersion: PLANT_TIMELINE_VERSION,
      plantId,
      entries:    Object.freeze(capped),
      groups:     Object.freeze(groups),
      counts:     Object.freeze(counts),
      totalCount: capped.length,
    });
  }, Object.freeze({
    runtimeVersion: PLANT_TIMELINE_VERSION,
    plantId:    '',
    entries:    Object.freeze([]),
    groups:     Object.freeze([]),
    counts:     Object.freeze({}),
    totalCount: 0,
  }));
}
