/**
 * programStore.js — local-first program model + CRUD
 * (NGO Onboarding spec §2).
 *
 *   import {
 *     saveProgram, getProgram, listPrograms, removeProgram,
 *   } from '../core/programs/programStore.js';
 *
 *   saveProgram({
 *     id:              'prog_001',
 *     organizationId:  'org_001',
 *     programName:     'Maize First Mile',
 *     country:         'GH',
 *     region:          'Ashanti',
 *     cropFocus:       'maize',
 *     season:          'main',
 *     startDate:       '2026-04-01',
 *     endDate:         '2026-09-30',
 *     defaultFarmSize: 'small',
 *     defaultLanguage: 'en',
 *     offlineModeEnabled: true,
 *   });
 *
 * Storage
 * ───────
 *   farroway_programs  →  JSON array of frozen program records.
 *
 * Why local-first
 * ───────────────
 * Spec §9 explicitly says "use current local/mock data if
 * backend not ready". The pilot runs without a server-side
 * program-management endpoint. This module gives every
 * downstream surface (PlanReadyScreen, NgoProgramDashboard,
 * dailyPlanEngine) a stable contract — when the backend
 * lands, the same shape ports straight to a SQL projection.
 *
 * Strict-rule audit
 *   • Pure outside the localStorage I/O. Wrapped + safe.
 *   • SSR-safe.
 *   • Idempotent: saveProgram on the same id replaces the
 *     prior record (upsert semantics).
 *   • Frozen records: callers can't mutate the stored shape
 *     by accident.
 */

import { safeParse } from '../../utils/safeParse.js';

export const PROGRAMS_STORE_KEY = 'farroway_programs';

const ALLOWED_FARM_SIZE = new Set(['small', 'medium', 'large', 'unknown']);

function _safeRead() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(PROGRAMS_STORE_KEY);
    if (!raw) return [];
    const parsed = safeParse(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _safeWrite(list) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(PROGRAMS_STORE_KEY, JSON.stringify(list));
  } catch { /* swallow */ }
}

function _str(v)    { return (typeof v === 'string' && v) ? v : null; }
function _strReq(v) { return (typeof v === 'string' && v) ? v : ''; }
function _bool(v)   { return v === true || v === false ? v : false; }

/**
 * Normalise a raw input into the canonical program shape.
 * Unknown / invalid fields collapse to safe defaults so a
 * stored record always has the documented shape.
 */
function _normalize(input) {
  const i = (input && typeof input === 'object') ? input : {};
  // farmSize values come from the spec's small/medium/large/
  // unknown vocabulary; anything else collapses to 'unknown'.
  const sizeRaw = String(i.defaultFarmSize || '').toLowerCase();
  const defaultFarmSize = ALLOWED_FARM_SIZE.has(sizeRaw) ? sizeRaw : 'unknown';
  return Object.freeze({
    id:                 _strReq(i.id),
    organizationId:     _strReq(i.organizationId),
    programName:        _strReq(i.programName),
    country:            _str(i.country),
    region:             _str(i.region),
    cropFocus:          _str(i.cropFocus),
    season:             _str(i.season),
    startDate:          _str(i.startDate),
    endDate:            _str(i.endDate),
    defaultFarmSize,
    defaultLanguage:    _str(i.defaultLanguage),
    offlineModeEnabled: _bool(i.offlineModeEnabled),
    createdAt:          _str(i.createdAt) || new Date().toISOString(),
  });
}

/**
 * saveProgram(input) → stored record | null.
 *
 * Upsert semantics: if a record with the same `id` exists,
 * it's replaced; otherwise the new record is appended.
 * Returns the stored shape (frozen). Returns null when the
 * input is invalid (missing id or organizationId).
 */
export function saveProgram(input) {
  const record = _normalize(input);
  if (!record.id || !record.organizationId) return null;
  const list = _safeRead();
  const idx  = list.findIndex((p) => p && p.id === record.id);
  if (idx >= 0) list[idx] = record;
  else list.push(record);
  _safeWrite(list);
  return record;
}

/** getProgram(id) → record | null. Stable shape (no surprise fields). */
export function getProgram(id) {
  if (!id) return null;
  const list = _safeRead();
  const hit = list.find((p) => p && p.id === id);
  return hit ? _normalize(hit) : null;
}

/** listPrograms() → array (newest first). */
export function listPrograms() {
  const list = _safeRead();
  return list
    .filter((p) => p && p.id)
    .map((p) => _normalize(p))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

/** removeProgram(id) → boolean (was found + removed). */
export function removeProgram(id) {
  if (!id) return false;
  const list = _safeRead();
  const next = list.filter((p) => !p || p.id !== id);
  if (next.length === list.length) return false;
  _safeWrite(next);
  return true;
}

/** Wipe all programs. Used by the privacy clear surface. */
export function resetProgramStore() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(PROGRAMS_STORE_KEY);
  } catch { /* swallow */ }
}

export default {
  PROGRAMS_STORE_KEY,
  saveProgram,
  getProgram,
  listPrograms,
  removeProgram,
  resetProgramStore,
};
