/**
 * networkStatus.js — lightweight shared layer for online / offline
 * state across Farroway.
 *
 *   getNetworkStatus() → { online, lastOnlineAt, lastOfflineAt, lastSyncAt }
 *   subscribeNetworkStatus(fn) → unsubscribe
 *   setLastSyncAt(ts) → record the most recent successful sync
 *   useNetworkStatus() → React hook returning the live status
 *
 * Source of truth is `navigator.onLine` plus the browser's `online`/
 * `offline` events. We deliberately DO NOT poll the network; noisy
 * fetches on a slow link hurt more than they help.
 *
 * Callers that want "is the app usable offline?" should use the
 * hook / subscribe model — reading `navigator.onLine` directly in
 * a component means you'll miss the offline → online transition.
 */

import { useEffect, useState } from 'react';

const DEFAULT = Object.freeze({
  online:         true,
  lastOnlineAt:   null,
  lastOfflineAt:  null,
  lastSyncAt:     null,
});

// Live-only state (in-memory). Persisted lastSyncAt mirror lives in
// localStorage so the UI can show "Last synced …" across reloads.
const STATE = { ...DEFAULT };
const LISTENERS = new Set();

const LAST_SYNC_KEY = 'farroway.lastSyncAt';

function isBrowser() {
  return typeof window !== 'undefined';
}

function hasStorage() {
  return isBrowser() && !!window.localStorage;
}

function notify() {
  const snapshot = { ...STATE };
  LISTENERS.forEach((fn) => { try { fn(snapshot); } catch { /* noop */ } });
}

function hydrateFromStorage() {
  if (!hasStorage()) return;
  try {
    const raw = window.localStorage.getItem(LAST_SYNC_KEY);
    const n = raw ? Number(raw) : NaN;
    if (Number.isFinite(n) && n > 0) STATE.lastSyncAt = n;
  } catch { /* ignore */ }
}

function initOnce() {
  if (!isBrowser() || initOnce.done) return;
  initOnce.done = true;
  STATE.online = navigator.onLine !== false;
  if (STATE.online) STATE.lastOnlineAt = Date.now();
  else STATE.lastOfflineAt = Date.now();

  const onOnline = () => {
    if (STATE.online) return;
    STATE.online = true;
    STATE.lastOnlineAt = Date.now();
    notify();
  };
  const onOffline = () => {
    if (!STATE.online) return;
    STATE.online = false;
    STATE.lastOfflineAt = Date.now();
    notify();
  };
  window.addEventListener('online',  onOnline);
  window.addEventListener('offline', onOffline);
}

if (isBrowser()) {
  hydrateFromStorage();
  initOnce();
}

export function getNetworkStatus() {
  return { ...STATE };
}

export function subscribeNetworkStatus(fn) {
  if (typeof fn !== 'function') return () => {};
  LISTENERS.add(fn);
  // Immediately push the current snapshot so the subscriber can
  // render without waiting for the next event.
  try { fn({ ...STATE }); } catch { /* noop */ }
  return () => LISTENERS.delete(fn);
}

export function setLastSyncAt(ts) {
  const when = Number.isFinite(ts) ? ts : Date.now();
  STATE.lastSyncAt = when;
  if (hasStorage()) {
    try { window.localStorage.setItem(LAST_SYNC_KEY, String(when)); }
    catch { /* quota / privacy mode — non-fatal */ }
  }
  notify();
}

/**
 * setOnlineForTesting — direct state override, test-only. Keeps the
 * engine testable without wrestling with jsdom's `navigator.onLine`.
 */
export function setOnlineForTesting(online) {
  const wasOnline = STATE.online;
  STATE.online = !!online;
  if (online && !wasOnline)  STATE.lastOnlineAt  = Date.now();
  if (!online && wasOnline)  STATE.lastOfflineAt = Date.now();
  notify();
}

export function useNetworkStatus() {
  const [state, setState] = useState(() => ({ ...STATE }));
  useEffect(() => subscribeNetworkStatus(setState), []);
  return state;
}

export const _internal = Object.freeze({
  LAST_SYNC_KEY, DEFAULT, LISTENERS, STATE,
});
