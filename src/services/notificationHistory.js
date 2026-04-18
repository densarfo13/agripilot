/**
 * Notification history — a bounded ring buffer in localStorage used for
 * deduplication and anti-spam checks by the notification engine.
 *
 * Entry shape: { id, type, dedupeKey, sentAt, openedAt?, dismissedAt? }
 */

const KEY = 'farroway:notification_history';
const MAX = 60; // keep ~60 entries to cap storage
const RETENTION_DAYS = 7;

function safeRead() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function safeWrite(entries) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch { /* quota exceeded — drop silently */ }
}

function pruneOld(entries) {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return entries.filter(e => (e.sentAt || 0) >= cutoff);
}

/** Read history (pruned, newest first). */
export function getHistory() {
  const pruned = pruneOld(safeRead());
  return [...pruned].sort((a, b) => b.sentAt - a.sentAt);
}

/** Append a sent entry and trim the buffer. */
export function recordSent({ id, type, dedupeKey, sentAt = Date.now() }) {
  const history = pruneOld(safeRead());
  history.push({ id: id || `${type}_${sentAt}`, type, dedupeKey, sentAt });
  // Cap to MAX, dropping oldest
  const trimmed = history.slice(-MAX);
  safeWrite(trimmed);
  return trimmed;
}

/** Mark a notification as opened (for analytics). */
export function recordOpened(id) {
  const history = safeRead();
  const idx = history.findIndex(e => e.id === id);
  if (idx < 0) return;
  history[idx].openedAt = Date.now();
  safeWrite(history);
}

/** Mark a notification as dismissed. */
export function recordDismissed(id) {
  const history = safeRead();
  const idx = history.findIndex(e => e.id === id);
  if (idx < 0) return;
  history[idx].dismissedAt = Date.now();
  safeWrite(history);
}

/** Clear history (dev / logout). */
export function clearHistory() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
