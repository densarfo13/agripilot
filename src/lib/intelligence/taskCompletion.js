/**
 * taskCompletion.js — lightweight per-farm per-date task-completion
 * store. Backed by localStorage so completions survive reloads
 * without touching the server.
 *
 * Why client-only (for now)?
 *   • Zero latency — mark done → FarrowayScore updates in place.
 *   • No schema migration — we can land the feature today; a
 *     server-side store is a strict upgrade when we're ready.
 *   • Offline-safe — farmers without reliable connectivity still
 *     see their own progress reflected in the score + alerts.
 *
 * Storage shape:
 *   farroway:taskCompletion:v1 → {
 *     [farmId]: {
 *       [YYYY-MM-DD]: {
 *         ids:      string[],    // completed templateIds
 *         at:       { [id]: ISO } // when each was marked done
 *       }
 *     }
 *   }
 *
 * Old dates (>30 days) are trimmed on every write to keep storage
 * small — farmers don't need a month-old completion log.
 *
 * API:
 *   listCompletedIds(farmId, date?)          → Set<string>
 *   markTaskDone(farmId, templateId, date?)  → Set<string>   (new set)
 *   unmarkTaskDone(farmId, templateId, d?)   → Set<string>
 *   clearDay(farmId, date?)                  → void
 *
 *   useTaskCompletion(farmId)  — React hook. Returns
 *     { completedIds, toggle, mark, unmark, clear }.
 *
 * All helpers are safe on SSR (typeof window checks).
 */

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'farroway:taskCompletion:v1';
const TRIM_DAYS   = 30;

function ymd(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function readAll() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

function writeAll(all) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    // Fire a storage event on the same tab so React subscribers
    // re-render without a full page reload. localStorage only
    // dispatches across tabs by default.
    try {
      window.dispatchEvent(new CustomEvent('farroway:taskCompletion', {
        detail: { ts: Date.now() },
      }));
    } catch { /* no-op */ }
  } catch { /* quota / private mode */ }
}

function trimOldDates(byFarm) {
  const out = { ...byFarm };
  const cutoff = Date.now() - TRIM_DAYS * 24 * 60 * 60 * 1000;
  for (const farmId of Object.keys(out)) {
    const days = out[farmId] || {};
    const keep = {};
    for (const date of Object.keys(days)) {
      const t = Date.parse(date);
      if (Number.isFinite(t) && t >= cutoff) keep[date] = days[date];
    }
    if (Object.keys(keep).length > 0) {
      out[farmId] = keep;
    } else {
      delete out[farmId];
    }
  }
  return out;
}

// ─── Pure helpers ────────────────────────────────────────────────
export function listCompletedIds(farmId, date = null) {
  if (!farmId) return new Set();
  const day = date || ymd();
  const all = readAll();
  const row = all && all[farmId] && all[farmId][day];
  if (!row || !Array.isArray(row.ids)) return new Set();
  return new Set(row.ids);
}

export function markTaskDone(farmId, templateId, date = null) {
  if (!farmId || !templateId) return new Set();
  const day = date || ymd();
  const all = trimOldDates(readAll());
  if (!all[farmId]) all[farmId] = {};
  if (!all[farmId][day]) all[farmId][day] = { ids: [], at: {} };
  const set = new Set(all[farmId][day].ids);
  if (!set.has(templateId)) {
    set.add(templateId);
    all[farmId][day].at[templateId] = new Date().toISOString();
    all[farmId][day].ids = Array.from(set);
    writeAll(all);
  }
  return set;
}

export function unmarkTaskDone(farmId, templateId, date = null) {
  if (!farmId || !templateId) return new Set();
  const day = date || ymd();
  const all = readAll();
  const row = all && all[farmId] && all[farmId][day];
  if (!row) return new Set();
  const set = new Set(row.ids);
  if (set.has(templateId)) {
    set.delete(templateId);
    if (row.at) delete row.at[templateId];
    row.ids = Array.from(set);
    writeAll(all);
  }
  return set;
}

export function clearDay(farmId, date = null) {
  if (!farmId) return;
  const day = date || ymd();
  const all = readAll();
  if (all && all[farmId] && all[farmId][day]) {
    delete all[farmId][day];
    writeAll(all);
  }
}

// ─── React hook ──────────────────────────────────────────────────
/**
 * useTaskCompletion(farmId, date?)
 *
 * Subscribes to the in-tab 'farroway:taskCompletion' event + cross-
 * tab 'storage' event so any component using this hook stays in
 * sync when another component marks a task done.
 */
export function useTaskCompletion(farmId, date = null) {
  const day = date || ymd();
  const [completedIds, setCompletedIds] = useState(() => listCompletedIds(farmId, day));

  useEffect(() => {
    setCompletedIds(listCompletedIds(farmId, day));
  }, [farmId, day]);

  useEffect(() => {
    function handler() { setCompletedIds(listCompletedIds(farmId, day)); }
    if (typeof window === 'undefined') return undefined;
    window.addEventListener('farroway:taskCompletion', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('farroway:taskCompletion', handler);
      window.removeEventListener('storage', handler);
    };
  }, [farmId, day]);

  const mark   = useCallback((id) => setCompletedIds(markTaskDone(farmId, id, day)),
                              [farmId, day]);
  const unmark = useCallback((id) => setCompletedIds(unmarkTaskDone(farmId, id, day)),
                              [farmId, day]);
  const toggle = useCallback((id) => {
    const cur = listCompletedIds(farmId, day);
    return cur.has(id) ? unmark(id) : mark(id);
  }, [farmId, day, mark, unmark]);
  const clear  = useCallback(() => { clearDay(farmId, day); setCompletedIds(new Set()); },
                              [farmId, day]);

  return { completedIds, toggle, mark, unmark, clear };
}

export const _internal = Object.freeze({ STORAGE_KEY, TRIM_DAYS, trimOldDates, ymd });
