/**
 * cropTimelineEngine.js — turns a farm's (crop, plantingDate,
 * cropStage, manualStageOverride) into a structured timeline.
 *
 *   getCropTimeline({ farm, now }) → {
 *     crop,                     // canonical lowercase crop key
 *     lifecycle: [ { key, durationDays }, … ],
 *     currentStage,             // canonical stage key
 *     currentStageIndex,
 *     nextStage,                // canonical stage key | null (harvest/last)
 *     nextStageIndex,
 *     daysIntoStage,
 *     stageDurationDays,
 *     estimatedDaysRemainingInStage,
 *     totalDurationDays,
 *     elapsedDays,              // since plantingDate (or stageStartedAt)
 *     overallProgressPercent,   // 0..100
 *     confidenceLevel,          // 'low' | 'medium' | 'high'
 *     source,                   // 'manual_override' | 'planting_date'
 *                               //   | 'stage_start' | 'stage_only' | 'generic'
 *     assumptions: Array<{ tag, detail }>,
 *     manualOverride: boolean,
 *     generatedAt: ISO string,
 *   } | null
 *
 * Pure. Deterministic. Never throws on partial inputs — if the
 * caller can only provide a crop, the engine returns a "stage_only"
 * timeline with confidence = 'low' instead of null, so the UI can
 * still render the lifecycle list.
 *
 * Source resolution priority (spec §6):
 *   1. manualStageOverride  → manual_override, confidence='medium'
 *   2. plantingDate         → planting_date, confidence='high'
 *   3. cropStage + stageStartedAt → stage_start, confidence='medium'
 *   4. cropStage only       → stage_only, confidence='low'
 *   5. nothing              → generic, confidence='low' (first stage)
 */

import {
  getLifecycle, normalizeStageKey, normalizeCropKey, hasLifecycle,
} from '../../config/cropLifecycles.js';
import {
  parseDate, daysBetween, totalDuration, stageAt,
} from './timelineHelpers.js';

function stageIndex(lifecycle, stageKey) {
  if (!stageKey) return -1;
  const norm = normalizeStageKey(stageKey);
  return lifecycle.findIndex((s) => s.key === norm);
}

function elapsedForIndex(lifecycle, idx, daysIntoStage = 0) {
  let acc = 0;
  for (let i = 0; i < idx; i += 1) {
    acc += Number(lifecycle[i].durationDays) || 0;
  }
  return acc + Math.max(0, daysIntoStage || 0);
}

export function getCropTimeline({ farm = null, now = null } = {}) {
  if (!farm || typeof farm !== 'object') return null;

  const cropKey = normalizeCropKey(farm.crop || farm.cropType);
  if (!cropKey) return null;

  const lifecycle = getLifecycle(cropKey);
  const total     = totalDuration(lifecycle);
  const nowTs     = parseDate(now) || new Date();
  const assumptions = [];
  const cropKnown = hasLifecycle(cropKey);

  if (!cropKnown) {
    assumptions.push({ tag: 'generic_lifecycle', detail:
      `No catalogued lifecycle for "${cropKey}" — using the generic 6-stage band.` });
  }

  // ── 1) Manual override wins ─────────────────────────────────
  if (farm.manualStageOverride) {
    const norm = normalizeStageKey(farm.manualStageOverride);
    const idx  = stageIndex(lifecycle, norm);
    if (idx >= 0) {
      const stage = lifecycle[idx];
      assumptions.push({ tag: 'manual_override', detail:
        'Using the manually selected stage. Clear the override to let the timeline re-estimate.' });
      const elapsed = elapsedForIndex(lifecycle, idx, 0);
      return finalise({
        cropKey, lifecycle, total, idx, daysInto: 0,
        stageDur: stage.durationDays || 0,
        daysRemain: stage.durationDays || 0,
        elapsed, source: 'manual_override',
        confidenceLevel: 'medium',
        assumptions, nowTs, manualOverride: true,
      });
    }
    // Override references an unknown stage — fall through to auto.
    assumptions.push({ tag: 'override_unknown_stage', detail:
      `Manual stage "${farm.manualStageOverride}" not in this crop's lifecycle — ignoring.` });
  }

  // ── 2) plantingDate-driven estimate ─────────────────────────
  const plantingDate = parseDate(farm.plantingDate);
  if (plantingDate) {
    // P4.13 — guard against future plantingDates. The form rejects
    // them, but legacy rows or imported data may still slip through.
    // Clamp to 0 and surface an assumption note so the UI can warn
    // the farmer ("Your planting date is in the future — please
    // correct it") rather than silently pretending day 0 is correct.
    const rawDays = daysBetween(plantingDate, nowTs) || 0;
    const elapsed = Math.max(0, rawDays);
    if (rawDays < 0) {
      assumptions.push({ tag: 'future_planting_date', detail:
        `Planting date is in the future (${Math.abs(rawDays)} day(s) ahead) — assuming day 0 of the cycle. Please correct the planting date if this is wrong.` });
    }
    const at = stageAt(elapsed, lifecycle);
    if (at) {
      assumptions.push({ tag: 'planting_date', detail:
        `Estimating from planting date (${elapsed} days elapsed).` });
      if (at.overshoot) {
        assumptions.push({ tag: 'past_lifecycle', detail:
          'Crop is past its typical lifecycle — treating it as ready for harvest.' });
      }
      return finalise({
        cropKey, lifecycle, total,
        idx: at.index, daysInto: at.daysIntoStage,
        stageDur: at.stageDurationDays, daysRemain: at.daysRemaining,
        elapsed, source: 'planting_date',
        confidenceLevel: cropKnown ? 'high' : 'medium',
        assumptions, nowTs,
      });
    }
  }

  // ── 3) cropStage + stageStartedAt → mid-stage estimate ──────
  const selected = normalizeStageKey(farm.cropStage || farm.stage);
  const selectedIdx = stageIndex(lifecycle, selected);
  const stageStartedAt = parseDate(farm.stageStartedAt);

  if (selectedIdx >= 0 && stageStartedAt) {
    const daysInto = Math.max(0, daysBetween(stageStartedAt, nowTs) || 0);
    const stage = lifecycle[selectedIdx];
    const dur = stage.durationDays || 0;
    const clamped = Math.min(daysInto, dur);
    const remain = Math.max(0, dur - clamped);
    const elapsed = elapsedForIndex(lifecycle, selectedIdx, clamped);
    assumptions.push({ tag: 'stage_start', detail:
      `Using selected stage with stage-start anchor (${daysInto} days in).` });
    return finalise({
      cropKey, lifecycle, total,
      idx: selectedIdx, daysInto: clamped,
      stageDur: dur, daysRemain: remain,
      elapsed, source: 'stage_start',
      confidenceLevel: 'medium',
      assumptions, nowTs,
    });
  }

  // ── 4) cropStage only — no timing anchor ────────────────────
  if (selectedIdx >= 0) {
    const stage = lifecycle[selectedIdx];
    const elapsed = elapsedForIndex(lifecycle, selectedIdx, 0);
    assumptions.push({ tag: 'stage_only', detail:
      'No planting date — showing the selected stage without a countdown.' });
    return finalise({
      cropKey, lifecycle, total,
      idx: selectedIdx, daysInto: 0,
      stageDur: stage.durationDays || 0,
      daysRemain: null,   // hide "days left" — we don't know
      elapsed, source: 'stage_only',
      confidenceLevel: 'low',
      assumptions, nowTs,
    });
  }

  // ── 5) Nothing — show the first stage as a placeholder ──────
  assumptions.push({ tag: 'no_anchor', detail:
    'No stage or planting date yet — showing stage 1 as a starting point.' });
  return finalise({
    cropKey, lifecycle, total,
    idx: 0, daysInto: 0,
    stageDur: lifecycle[0].durationDays || 0,
    daysRemain: null,
    elapsed: 0, source: 'generic',
    confidenceLevel: 'low',
    assumptions, nowTs,
  });
}

function finalise({
  cropKey, lifecycle, total, idx, daysInto, stageDur, daysRemain,
  elapsed, source, confidenceLevel, assumptions, nowTs,
  manualOverride = false,
}) {
  const nextIdx = idx < lifecycle.length - 1 ? idx + 1 : -1;
  // Overall progress: days elapsed against the total lifecycle. Null
  // when we have no elapsed anchor (source = 'generic').
  let overallProgressPercent = null;
  if (Number.isFinite(elapsed) && total > 0 && source !== 'generic') {
    overallProgressPercent = Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
  } else if (source === 'manual_override' || source === 'stage_only') {
    // Use stage-start progress so the UI still shows SOMETHING useful
    // when the user manually picked a stage — progress anchored on
    // "the start of this stage" rather than planting date.
    const stageStart = (() => {
      let acc = 0;
      for (let i = 0; i < idx; i += 1) acc += lifecycle[i].durationDays || 0;
      return acc;
    })();
    overallProgressPercent = total > 0
      ? Math.max(0, Math.min(100, Math.round((stageStart / total) * 100)))
      : 0;
  }

  return Object.freeze({
    crop: cropKey,
    lifecycle: Object.freeze(lifecycle.map((s) => Object.freeze({ ...s }))),
    currentStage: lifecycle[idx].key,
    currentStageIndex: idx,
    nextStage: nextIdx >= 0 ? lifecycle[nextIdx].key : null,
    nextStageIndex: nextIdx,
    daysIntoStage: Math.round(daysInto || 0),
    stageDurationDays: stageDur,
    estimatedDaysRemainingInStage: daysRemain,  // number | null
    totalDurationDays: total,
    elapsedDays: Math.round(elapsed || 0),
    overallProgressPercent,
    confidenceLevel,
    source,
    manualOverride,
    assumptions: Object.freeze(assumptions),
    generatedAt: nowTs instanceof Date ? nowTs.toISOString() : new Date().toISOString(),
  });
}

export const _internal = Object.freeze({ stageIndex, elapsedForIndex, finalise });
