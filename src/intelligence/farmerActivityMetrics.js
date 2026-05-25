/**
 * farmerActivityMetrics.js — Phase 4 stub.
 *
 * STATUS: STUB BACKLOG. NOT imported anywhere. Designed entrypoint
 * for per-farmer activity rollups (task completion, photo uploads,
 * scans, voice interactions, login cadence) used by NGO operators
 * + admin support to identify disengaged or stuck farmers.
 *
 * Output shape:
 *
 *   {
 *     farmerId:           string | null,
 *     tasksCompleted30d:  number | null,
 *     scansSubmitted30d:  number | null,
 *     photosUploaded30d:  number | null,
 *     voiceInteractions30d: number | null,
 *     lastActiveISO:      string | null,
 *     engagementBucket:   'inactive'|'low'|'normal'|'high'|null,
 *     streakDays:         number | null,
 *   }
 */

export function buildFarmerActivityMetrics(input = {}) {
  return Object.freeze({
    farmerId:           (input && input.farmerId) || null,
    tasksCompleted30d:  null,
    scansSubmitted30d:  null,
    photosUploaded30d:  null,
    voiceInteractions30d: null,
    lastActiveISO:      null,
    engagementBucket:   null,
    streakDays:         null,
    _input:             input,
    _version:           FARMER_ACTIVITY_METRICS_VERSION,
  });
}

export const FARMER_ACTIVITY_METRICS_VERSION = '0.1.0-stub';
