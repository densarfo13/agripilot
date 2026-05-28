/**
 * useFarmerNotificationsRuntime.js — RUNTIME hook that owns the
 * farmer-notifications lifecycle.
 *
 *   const {
 *     notifications, loading, loadError,
 *     filter, setFilter,
 *     markRead, markAllRead,
 *     markingAll, actionError,
 *     unreadCount, refresh,
 *   } = useFarmerNotificationsRuntime({ farmerId, onChange });
 *
 * Ownership contract
 * ──────────────────
 *   THIS HOOK OWNS (so pages don't):
 *     • fetch lifecycle (mount + filter-change + manual refresh)
 *     • loading state + error state separation (load vs action)
 *     • retry-on-transient via the SERVICE-layer wrapper
 *     • optimistic local mutation on markRead (single + bulk)
 *     • request cancellation on unmount or rapid re-fetch (via a
 *       monotonic request id — late responses are discarded)
 *     • telemetry (request count + last-fetch timestamp)
 *
 *   The page that consumes this hook is a PURE SUBSCRIBER — it
 *   never calls `api.*` directly, never owns its own retry, never
 *   owns its own loading flag.
 *
 *   The `onChange` callback (optional) is invoked after every
 *   successful mark-read mutation so external consumers (e.g. the
 *   farmer home page's unread-badge in the header) can re-fetch
 *   their own count.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Stable returned reference per render (useMemo around the
 *     output bag).
 *   • Optimistic update is reverted on failure of the underlying
 *     mutation — UI doesn't drift from the server.
 *   • RUNTIME → SERVICE import (allowed).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchFarmerNotifications,
  markFarmerNotificationRead,
  markAllFarmerNotificationsRead,
} from '../services/notifications/farmerNotificationsService.js';

const RUNTIME_VERSION = 'farmer-notifications-runtime-v1';

// Module-level lightweight telemetry so __apiOwnership() /
// __runtimeFetches() can introspect what the runtime is doing.
const _telemetry = {
  loadCount:      0,
  loadErrorCount: 0,
  markReadCount:  0,
  markAllCount:   0,
  lastLoadAt:     null,
};

export function getFarmerNotificationsRuntimeTelemetry() {
  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    loadCount:      _telemetry.loadCount,
    loadErrorCount: _telemetry.loadErrorCount,
    markReadCount:  _telemetry.markReadCount,
    markAllCount:   _telemetry.markAllCount,
    lastLoadAt:     _telemetry.lastLoadAt,
  });
}

const _isFn = (v) => typeof v === 'function';

export function useFarmerNotificationsRuntime({ farmerId, onChange } = {}) {
  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [loadError,     setLoadError]     = useState('');
  const [filter,        setFilter]        = useState('');
  const [markingAll,    setMarkingAll]    = useState(false);
  const [actionError,   setActionError]   = useState('');

  // Monotonic request id — late responses with a stale id are
  // discarded so a slow first request can't overwrite a fresh
  // second request's data.
  const _reqIdRef = useRef(0);
  const _mountedRef = useRef(true);
  useEffect(() => () => { _mountedRef.current = false; }, []);

  const refresh = useCallback(async () => {
    if (!farmerId) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    _reqIdRef.current += 1;
    const myReqId = _reqIdRef.current;
    setLoading(true);
    setLoadError('');
    _telemetry.loadCount += 1;
    const res = await fetchFarmerNotifications(farmerId, { filter });
    if (!_mountedRef.current) return;
    if (myReqId !== _reqIdRef.current) return; // stale; superseded
    if (res && res.ok) {
      setNotifications(Array.isArray(res.data) ? res.data : []);
      _telemetry.lastLoadAt = new Date().toISOString();
    } else {
      _telemetry.loadErrorCount += 1;
      setLoadError('Failed to load notifications');
    }
    setLoading(false);
  }, [farmerId, filter]);

  // Auto-fetch on mount + farmerId + filter change.
  useEffect(() => { refresh(); }, [refresh]);

  const markRead = useCallback(async (id) => {
    if (!id) return;
    setActionError('');
    // Optimistic update — flip read flag locally before the network
    // returns. Reverted on failure so UI never drifts from server.
    const snapshot = notifications;
    setNotifications((prev) => prev.map((n) =>
      n.id === id ? { ...n, read: true } : n));
    _telemetry.markReadCount += 1;
    const res = await markFarmerNotificationRead(id);
    if (!_mountedRef.current) return;
    if (!res || !res.ok) {
      setNotifications(snapshot);
      setActionError('Failed to mark as read. Please try again.');
      return;
    }
    if (_isFn(onChange)) {
      try { onChange({ kind: 'mark_read', id }); } catch { /* swallow */ }
    }
  }, [notifications, onChange]);

  const markAllRead = useCallback(async () => {
    if (!farmerId) return;
    setMarkingAll(true);
    setActionError('');
    _telemetry.markAllCount += 1;
    const res = await markAllFarmerNotificationsRead(farmerId);
    if (!_mountedRef.current) return;
    if (!res || !res.ok) {
      setActionError('Failed to mark all as read. Please try again.');
      setMarkingAll(false);
      return;
    }
    // Re-fetch to pick up server's authoritative state (e.g. last-
    // read timestamps the server stamped) instead of just flipping
    // every entry's read flag locally.
    await refresh();
    if (!_mountedRef.current) return;
    setMarkingAll(false);
    if (_isFn(onChange)) {
      try { onChange({ kind: 'mark_all_read' }); } catch { /* swallow */ }
    }
  }, [farmerId, refresh, onChange]);

  const unreadCount = useMemo(
    () => (Array.isArray(notifications)
      ? notifications.filter((n) => n && !n.read).length
      : 0),
    [notifications],
  );

  return useMemo(() => ({
    notifications,
    loading,
    loadError,
    filter,
    setFilter,
    markRead,
    markAllRead,
    markingAll,
    actionError,
    unreadCount,
    refresh,
  }), [
    notifications, loading, loadError, filter,
    markRead, markAllRead, markingAll, actionError,
    unreadCount, refresh,
  ]);
}

const _module = {
  useFarmerNotificationsRuntime,
  getFarmerNotificationsRuntimeTelemetry,
};
export default _module;
